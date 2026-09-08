"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: any;
  }
}

interface Review {
  name: string;
  text: string;
  stars: number;
  publishedAtDate?: string;
  placeTitle?: string;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const googleMapRef = useRef<any>(null);
  const mainMarkerRef = useRef<any>(null);

  // Referências para armazenar marcadores e quadrados para limpá-los quando necessário
  const markersRef = useRef<any[]>([]);
  const squaresRef = useRef<any[]>([]);

  // Parâmetros da raspagem no Apify
  const [apifyConfig, setApifyConfig] = useState({
    searchString: "Restaurantes",
    locationQuery: "Picuí, PB",
    maxPlaces: 5,
    maxReviews: 20,
    language: "pt-BR",
    reviewsSort: "newest",
    oneReviewPerRow: true
  });

  // Campo para carregar dataset existente sem gastar créditos
  const [existingDatasetId, setExistingDatasetId] = useState("");

  // Estados da aplicação
  const [carregando, setCarregando] = useState(false);
  const [statusMensagem, setStatusMensagem] = useState("");
  const [reviewsDestaque, setReviewsDestaque] = useState<Review[]>([]);
  const [locaisEncontrados, setLocaisEncontrados] = useState<any[]>([]);

  // Função para definir as cores (Verde -> Amarelo -> Vermelho) baseadas na nota
  const getCoresPorNota = (nota: number) => {
    if (nota >= 4.5) return { fill: "#10B981", stroke: "#047857" }; // Verde forte/positivo
    if (nota >= 4.0) return { fill: "#84CC16", stroke: "#4D7C0F" }; // Verde claro / Lima
    if (nota >= 3.0) return { fill: "#FBBF24", stroke: "#B45309" }; // Amarelo
    if (nota >= 2.0) return { fill: "#F97316", stroke: "#C2410C" }; // Laranja
    return { fill: "#EF4444", stroke: "#B91C1C" };                  // Vermelho
  };

  // Calcula a caixa delimitadora (Bounds) de um QUADRADO de ~10 metros em volta do ponto
  const calcularBoundsQuadrado = (lat: number, lng: number, metrosOffset: number = 10) => {
    const latOffset = metrosOffset / 111000;
    const lngOffset = metrosOffset / (111000 * Math.cos((lat * Math.PI) / 180));

    return {
      south: lat - latOffset,
      north: lat + latOffset,
      west: lng - lngOffset,
      east: lng + lngOffset,
    };
  };

  // Inicialização do Google Maps e Autocomplete
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    const initMap = () => {
      if (!window.google || googleMapRef.current) return;

      const posicaoInicial = { lat: -6.5084879, lng: -36.348518 }; // Picuí - PB

      if (mapRef.current) {
        googleMapRef.current = new window.google.maps.Map(mapRef.current, {
          center: posicaoInicial,
          zoom: 13,
        });

        mainMarkerRef.current = new window.google.maps.Marker({
          position: posicaoInicial,
          map: googleMapRef.current,
        });
      }

      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          {
            fields: ["address_components", "geometry", "name", "formatted_address"],
            types: ["geocode", "establishment"]
          }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();

          if (place.geometry && place.geometry.location) {
            const novaPosicao = place.geometry.location;
            if (googleMapRef.current && mainMarkerRef.current) {
              googleMapRef.current.setCenter(novaPosicao);
              googleMapRef.current.setZoom(16);
              mainMarkerRef.current.setPosition(novaPosicao);
            }
          }

          const endereco = place.formatted_address || place.name;
          if (endereco) {
            setApifyConfig((prev) => ({ ...prev, locationQuery: endereco }));
          }
        });
      }
    };

    if (window.google) {
      initMap();
      return;
    }

    const scriptExistente = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (scriptExistente) {
      scriptExistente.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);

  }, []);

  const handleApifyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setApifyConfig((prev) => ({ ...prev, [name]: val }));
  };

  // Limpa os elementos desenhados anteriormente no mapa
  const limparDesenhosDoMapa = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    squaresRef.current.forEach((s) => s.setMap(null));
    squaresRef.current = [];
  };

  // Desenha os QUADRADOS DE 10M com CORES DINÂMICAS no mapa
  const desenharELocalizarNoMapa = (items: any[]) => {
    if (!googleMapRef.current || !window.google) return;

    limparDesenhosDoMapa();

    const bounds = new window.google.maps.LatLngBounds();
    
    // Mapeia locais únicos para calcular a média de nota e evitar sobreposição
    const locaisAgrupados = new Map<string, { lat: number; lng: number; title: string; notas: number[] }>();

    items.forEach((item) => {
      const lat = item.location?.lat ?? item.latitude ?? item.lat;
      const lng = item.location?.lng ?? item.longitude ?? item.lng;

      if (typeof lat === "number" && typeof lng === "number") {
        const chavePonto = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        const nota = item.stars || item.rating || item.totalScore;

        if (!locaisAgrupados.has(chavePonto)) {
          locaisAgrupados.set(chavePonto, {
            lat,
            lng,
            title: item.title || item.placeTitle || item.name || "Local",
            notas: typeof nota === "number" ? [nota] : [],
          });
        } else if (typeof nota === "number") {
          locaisAgrupados.get(chavePonto)!.notas.push(nota);
        }
      }
    });

    let pontosValidos = 0;

    locaisAgrupados.forEach((dados) => {
      const posicao = new window.google.maps.LatLng(dados.lat, dados.lng);

      // Calcula a nota média do local (se não houver notas, assume 5 por padrão)
      const notaMedia = dados.notas.length > 0
        ? dados.notas.reduce((a, b) => a + b, 0) / dados.notas.length
        : 5;

      // Obtém as cores baseadas no desempenho da nota
      const cores = getCoresPorNota(notaMedia);

      // 1. Desenha o QUADRADO de ~10 Metros de raio em volta do local
      const boundsQuadrado = calcularBoundsQuadrado(dados.lat, dados.lng, 10);
      
      const quadrado = new window.google.maps.Rectangle({
        bounds: boundsQuadrado,
        strokeColor: cores.stroke,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: cores.fill,
        fillOpacity: 0.55,
        map: googleMapRef.current,
      });
      squaresRef.current.push(quadrado);

      // 2. Adiciona o Marcador/Pino com a mesma cor no centro
      const marcador = new window.google.maps.Marker({
        position: posicao,
        map: googleMapRef.current,
        title: `${dados.title} (${notaMedia.toFixed(1)} ★)`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: cores.fill,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#FFFFFF",
        },
      });

      // Balão de Informações ao clicar no pino ou quadrado
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color:#000000; font-family:sans-serif; padding:4px;">
            <strong style="font-size:14px; display:block; color:#000000;">${dados.title}</strong>
            <span style="color:${cores.stroke}; font-weight:bold; font-size:13px;">
              ★ ${notaMedia.toFixed(1)} / 5.0
            </span>
          </div>
        `,
      });

      marcador.addListener("click", () => {
        infoWindow.open(googleMapRef.current, marcador);
      });

      markersRef.current.push(marcador);

      bounds.extend(posicao);
      pontosValidos++;
    });

    // Centraliza e ajusta o zoom do mapa para os locais encontrados
    if (pontosValidos > 0) {
      googleMapRef.current.fitBounds(bounds);

      if (pontosValidos === 1) {
        setTimeout(() => {
          googleMapRef.current.setZoom(18);
        }, 150);
      }
    }
  };

  // Processa o dataset unificando ambos os formatos
  const processarResultados = (items: any[]) => {
    console.log("Dados recebidos do Apify:", items);

    let locais: any[] = [];
    let extraidas: Review[] = [];

    items.forEach((item) => {
      if (item.title || item.placeId) {
        locais.push(item);
      }

      if (item.stars !== undefined || item.rating !== undefined || item.reviewId || item.reviewerId) {
        extraidas.push({
          name: item.name || item.authorName || item.reviewerName || "Usuário do Google",
          text: item.text || item.textTranslated || "O usuário deixou apenas uma nota sem comentário escrito.",
          stars: item.stars || item.rating || 5,
          publishedAtDate: item.publishedAtDate || item.publishDate || item.publishedAt,
          placeTitle: item.placeTitle || item.title || item.searchString || "",
        });
      }

      if (item.reviews && Array.isArray(item.reviews)) {
        item.reviews.forEach((rev: any) => {
          extraidas.push({
            name: rev.name || rev.authorName || "Usuário do Google",
            text: rev.text || rev.textTranslated || "O usuário deixou apenas uma nota sem comentário escrito.",
            stars: rev.stars || rev.rating || 5,
            publishedAtDate: rev.publishedAtDate || rev.publishDate,
            placeTitle: item.title || "",
          });
        });
      }
    });

    const ordenadas = extraidas.sort((a, b) => {
      const temTextoA = a.text && !a.text.includes("sem comentário") ? 1 : 0;
      const temTextoB = b.text && !b.text.includes("sem comentário") ? 1 : 0;

      if (temTextoA !== temTextoB) {
        return temTextoB - temTextoA;
      }
      return (b.stars || 0) - (a.stars || 0);
    });

    setLocaisEncontrados(locais);
    setReviewsDestaque(ordenadas);

    desenharELocalizarNoMapa(items);
  };

  const consultarDataset = async (datasetId: string) => {
    setStatusMensagem("Aguardando extração do Apify...");

    const tentativasMaximas = 30;
    let tentativa = 0;

    const interval = setInterval(async () => {
      tentativa++;
      try {
        const response = await fetch(`/api/apify/dataset?datasetId=${datasetId}`);
        const data = await response.json();

        if (data.success && data.items && data.items.length > 0) {
          clearInterval(interval);
          processarResultados(data.items);
          setCarregando(false);
          setStatusMensagem("");
          return;
        }

        if (tentativa >= tentativasMaximas) {
          clearInterval(interval);
          setCarregando(false);
          setStatusMensagem("Tempo limite atingido. Verifique o painel do Apify.");
        } else {
          setStatusMensagem(`Aguardando robô... (${tentativa * 4}s decorridos)`);
        }
      } catch (error) {
        console.error("Erro ao consultar dataset:", error);
      }
    }, 4000);
  };

  const carregarDatasetExistente = async () => {
    if (!existingDatasetId.trim()) {
      alert("Por favor, informe o Dataset ID ou Run ID!");
      return;
    }

    setCarregando(true);
    setStatusMensagem("Buscando dados no Apify...");
    setReviewsDestaque([]);
    setLocaisEncontrados([]);

    try {
      const response = await fetch(`/api/apify/dataset?datasetId=${existingDatasetId.trim()}`);
      const data = await response.json();

      if (data.success && data.items) {
        processarResultados(data.items);
        setStatusMensagem("");
      } else {
        alert("Não foi possível carregar os dados desse Dataset ID.");
      }
    } catch (error) {
      alert("Erro ao buscar dataset antigo.");
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  const buscarNoApify = async () => {
    if (!apifyConfig.locationQuery || !apifyConfig.searchString) {
      alert("Por favor, preencha a categoria e o local!");
      return;
    }

    setCarregando(true);
    setReviewsDestaque([]);
    setLocaisEncontrados([]);
    setStatusMensagem("Disparando raspagem no Apify...");

    try {
      const response = await fetch("/api/apify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyConfig),
      });

      const data = await response.json();

      if (response.ok && data.datasetId) {
        setExistingDatasetId(data.datasetId);
        consultarDataset(data.datasetId);
      } else {
        alert(`Falha ao iniciar raspagem: ${data.error || "Erro desconhecido"}`);
        setCarregando(false);
        setStatusMensagem("");
      }
    } catch (error) {
      alert("Erro crítico ao conectar com a API.");
      console.error(error);
      setCarregando(false);
      setStatusMensagem("");
    }
  };

  return (
    <main style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto", color: "#000000" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px", color: "#111827" }}>Buscador Integrado: Google Maps + Apify</h1>

      {/* Barra de Busca de Local do Google Maps */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Busque no mapa (ex: Picuí, Avenida Paulista)..."
          style={{
            padding: "12px", width: "100%", maxWidth: "600px",
            fontSize: "16px", borderRadius: "6px", border: "1px solid #9ca3af",
            color: "#000000", backgroundColor: "#ffffff"
          }}
        />
      </div>

      {/* Container Principal: Menu Lateral + Mapa */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginBottom: "40px" }}>

        {/* Sidebar de Controles */}
        <aside style={{
          width: "340px", backgroundColor: "#f9fafb", padding: "20px",
          borderRadius: "12px", border: "1px solid #d1d5db", boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          color: "#000000"
        }}>
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", color: "#111827" }}>Nova Raspagem</h3>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px", color: "#111827" }}>Categoria / Busca:</label>
            <input
              type="text" name="searchString" value={apifyConfig.searchString} onChange={handleApifyChange}
              placeholder="Ex: Restaurantes, Pizzaria..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", color: "#000000", backgroundColor: "#ffffff" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px", color: "#111827" }}>Localização:</label>
            <input
              type="text" name="locationQuery" value={apifyConfig.locationQuery} onChange={handleApifyChange}
              placeholder="Ex: Picuí, PB"
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", color: "#000000", backgroundColor: "#ffffff" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px", color: "#111827" }}>Max Locais:</label>
              <input
                type="number" name="maxPlaces" value={apifyConfig.maxPlaces} onChange={handleApifyChange} min="1"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", color: "#000000", backgroundColor: "#ffffff" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px", color: "#111827" }}>Max Reviews:</label>
              <input
                type="number" name="maxReviews" value={apifyConfig.maxReviews} onChange={handleApifyChange} min="0"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", color: "#000000", backgroundColor: "#ffffff" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px", color: "#111827" }}>Ordenar Reviews Por:</label>
            <select
              name="reviewsSort" value={apifyConfig.reviewsSort} onChange={handleApifyChange}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", color: "#000000", backgroundColor: "#ffffff" }}
            >
              <option value="newest" style={{ color: "#000" }}>Mais recentes</option>
              <option value="highestRating" style={{ color: "#000" }}>Maior nota</option>
              <option value="lowestRating" style={{ color: "#000" }}>Menor nota</option>
              <option value="mostRelevant" style={{ color: "#000" }}>Mais relevantes</option>
            </select>
          </div>

          <button
            onClick={buscarNoApify}
            disabled={carregando}
            style={{
              width: "100%", padding: "12px", backgroundColor: carregando ? "#6c757d" : "#10a37f", color: "#ffffff",
              border: "none", borderRadius: "6px", fontWeight: "bold", cursor: carregando ? "not-allowed" : "pointer"
            }}
          >
            {carregando ? "Processando..." : "🚀 Iniciar Raspagem"}
          </button>

          {/* Seção para Carregar Dataset já existente */}
          <div style={{ marginTop: "25px", paddingTop: "15px", borderTop: "2px solid #e5e7eb" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#111827" }}>Carregar Dataset / Run Antigo</h4>
            <input
              type="text"
              value={existingDatasetId}
              onChange={(e) => setExistingDatasetId(e.target.value)}
              placeholder="Insira o Dataset ID ou Run ID..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #9ca3af", marginBottom: "8px", color: "#000000", backgroundColor: "#ffffff" }}
            />
            <button
              onClick={carregarDatasetExistente}
              disabled={carregando}
              style={{
                width: "100%", padding: "8px", backgroundColor: "#0070f3", color: "#ffffff",
                border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer", fontWeight: "bold"
              }}
            >
              📥 Buscar Dados Salvos
            </button>
          </div>

          {statusMensagem && (
            <p style={{ marginTop: "15px", fontSize: "13px", color: "#0070f3", textAlign: "center", fontWeight: "bold" }}>
              ⏳ {statusMensagem}
            </p>
          )}
        </aside>

        {/* Mapa Interativo */}
        <div
          ref={mapRef}
          style={{
            flex: 1, height: "560px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        />
      </div>

      {/* Legenda das Cores */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "20px", marginBottom: "30px",
        padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "8px", fontSize: "13px", color: "#111827",
        border: "1px solid #e5e7eb"
      }}>
        <span><strong style={{ color: "#10B981" }}>■ 4.5 - 5.0 ★</strong> Excelente</span>
        <span><strong style={{ color: "#84CC16" }}>■ 4.0 - 4.4 ★</strong> Bom</span>
        <span><strong style={{ color: "#D97706" }}>■ 3.0 - 3.9 ★</strong> Mediano</span>
        <span><strong style={{ color: "#EA580C" }}>■ 2.0 - 2.9 ★</strong> Ruim</span>
        <span><strong style={{ color: "#DC2626" }}>■ &lt; 2.0 ★</strong> Péssimo</span>
      </div>

      {/* Seção 1: Exibição dos Locais Encontrados */}
      {locaisEncontrados.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ color: "#111827" }}>Locais Encontrados ({locaisEncontrados.length})</h2>
          <div style={{ display: "flex", gap: "15px", overflowX: "auto", paddingBottom: "10px" }}>
            {locaisEncontrados.map((lugar, i) => (
              <div key={i} style={{ minWidth: "260px", border: "1px solid #d1d5db", borderRadius: "8px", padding: "14px", backgroundColor: "#ffffff", color: "#000000" }}>
                <strong style={{ fontSize: "16px", color: "#111827", display: "block" }}>{lugar.title || lugar.name || "Local sem título"}</strong>
                <p style={{ margin: "6px 0", fontSize: "13px", color: "#4b5563" }}>{lugar.address || lugar.city || "Endereço não informado"}</p>
                <div style={{ marginTop: "8px" }}>
                  <span style={{ color: "#d97706", fontSize: "14px", fontWeight: "bold" }}>
                    ★ {lugar.totalScore || lugar.stars || "N/A"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "6px" }}>
                    ({lugar.reviewsCount || 0} avaliações no Google)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seção 2: Grid das Avaliações */}
      {reviewsDestaque.length > 0 ? (
        <section>
          <h2 style={{ color: "#111827" }}>Avaliações Extraídas ({reviewsDestaque.length})</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
            marginTop: "15px"
          }}>
            {reviewsDestaque.map((rev, index) => (
              <div key={index} style={{
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                backgroundColor: "#ffffff",
                color: "#000000"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#111827" }}>{rev.name}</strong>
                  <span style={{ color: "#d97706", fontWeight: "bold", fontSize: "16px" }}>
                    {"★".repeat(Math.max(1, Math.min(5, rev.stars)))}
                  </span>
                </div>

                {rev.placeTitle && (
                  <span style={{ fontSize: "11px", color: "#0070f3", fontWeight: "bold", display: "block", marginTop: "4px" }}>
                    📍 {rev.placeTitle}
                  </span>
                )}

                <p style={{
                  color: rev.text.includes("sem comentário") ? "#6b7280" : "#1f2937",
                  fontSize: "14px",
                  marginTop: "12px",
                  lineHeight: "1.5",
                  fontStyle: rev.text.includes("sem comentário") ? "italic" : "normal"
                }}>
                  "{rev.text}"
                </p>

                {rev.publishedAtDate && (
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block", marginTop: "12px" }}>
                    Data: {new Date(rev.publishedAtDate).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        !carregando && (
          <div style={{ textAlign: "center", padding: "30px", color: "#4b5563", border: "2px dashed #9ca3af", borderRadius: "12px" }}>
            Nenhuma avaliação carregada no momento. Faça uma nova busca ou insira um Dataset ID antigo ao lado.
          </div>
        )
      )}
    </main>
  );
}