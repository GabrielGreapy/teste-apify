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
  const markerRef = useRef<any>(null);

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

        markerRef.current = new window.google.maps.Marker({
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
            if (googleMapRef.current && markerRef.current) {
              googleMapRef.current.setCenter(novaPosicao);
              googleMapRef.current.setZoom(16);
              markerRef.current.setPosition(novaPosicao);
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

  // Processa o dataset unificando ambos os formatos (oneReviewPerRow: true ou false)
  const processarResultados = (items: any[]) => {
    console.log("Dados recebidos para processamento:", items);

    let locais: any[] = [];
    let extraidas: Review[] = [];

    items.forEach((item) => {
      // Se for um item de local
      if (item.title || item.placeId) {
        locais.push(item);
      }

      // 1. Estrutura onde cada linha do dataset JÁ É uma avaliação individual
      if (item.stars !== undefined || item.rating !== undefined || item.reviewId || item.reviewerId) {
        extraidas.push({
          name: item.name || item.authorName || item.reviewerName || "Usuário do Google",
          text: item.text || item.textTranslated || "O usuário deixou apenas uma nota sem comentário escrito.",
          stars: item.stars || item.rating || 5,
          publishedAtDate: item.publishedAtDate || item.publishDate || item.publishedAt,
          placeTitle: item.placeTitle || item.title || item.searchString || "",
        });
      }

      // 2. Estrutura onde as avaliações estão em um array dentro de um local (oneReviewPerRow: false)
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

    // Ordena colocando avaliações com comentários escritos no topo, depois pelas melhores notas
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
  };

  // Consulta um dataset existente no Apify por Polling
  const consultarDataset = async (datasetId: string) => {
    setStatusMensagem("Aguardando extração do Apify...");

    const tentativasMaximas = 30; // 2 minutos
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

  // Carrega diretamente um Dataset ou Run antigo sem disparar nova raspagem
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

  // Iniciar nova raspagem no Apify
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
        setExistingDatasetId(data.datasetId); // Preenche automaticamente o ID
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
    <main style={{ padding: "30px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>Buscador Integrado: Google Maps + Apify</h1>

      {/* Barra de Busca de Local do Google Maps */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Busque no mapa (ex: Picuí, Avenida Paulista)..."
          style={{
            padding: "12px", width: "100%", maxWidth: "600px",
            fontSize: "16px", borderRadius: "6px", border: "1px solid #ccc"
          }}
        />
      </div>

      {/* Container Principal: Menu Lateral + Mapa */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginBottom: "40px" }}>

        {/* Sidebar de Controles */}
        <aside style={{
          width: "340px", backgroundColor: "#f8f9fa", padding: "20px",
          borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Nova Raspagem</h3>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>Categoria / Busca:</label>
            <input
              type="text" name="searchString" value={apifyConfig.searchString} onChange={handleApifyChange}
              placeholder="Ex: Restaurantes, Pizzaria..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>Localização:</label>
            <input
              type="text" name="locationQuery" value={apifyConfig.locationQuery} onChange={handleApifyChange}
              placeholder="Ex: Picuí, PB"
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "#fff" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>Max Locais:</label>
              <input
                type="number" name="maxPlaces" value={apifyConfig.maxPlaces} onChange={handleApifyChange} min="1"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>Max Reviews:</label>
              <input
                type="number" name="maxReviews" value={apifyConfig.maxReviews} onChange={handleApifyChange} min="0"
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>Ordenar Reviews Por:</label>
            <select
              name="reviewsSort" value={apifyConfig.reviewsSort} onChange={handleApifyChange}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="newest">Mais recentes</option>
              <option value="highestRating">Maior nota</option>
              <option value="lowestRating">Menor nota</option>
              <option value="mostRelevant">Mais relevantes</option>
            </select>
          </div>

          <button
            onClick={buscarNoApify}
            disabled={carregando}
            style={{
              width: "100%", padding: "12px", backgroundColor: carregando ? "#6c757d" : "#10a37f", color: "white",
              border: "none", borderRadius: "6px", fontWeight: "bold", cursor: carregando ? "not-allowed" : "pointer"
            }}
          >
            {carregando ? "Processando..." : "🚀 Iniciar Raspagem"}
          </button>

          {/* Seção para Carregar Dataset já existente sem gastar saldo */}
          <div style={{ marginTop: "25px", paddingTop: "15px", borderTop: "2px stroke #ddd" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Carregar Dataset / Run Antigo</h4>
            <input
              type="text"
              value={existingDatasetId}
              onChange={(e) => setExistingDatasetId(e.target.value)}
              placeholder="Insira o Dataset ID ou Run ID..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", marginBottom: "8px" }}
            />
            <button
              onClick={carregarDatasetExistente}
              disabled={carregando}
              style={{
                width: "100%", padding: "8px", backgroundColor: "#0070f3", color: "white",
                border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer"
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

      {/* Seção 1: Exibição dos Locais Encontrados */}
      {locaisEncontrados.length > 0 && (
        <section style={{ marginBottom: "40px" }}>
          <h2>Locais Encontrados ({locaisEncontrados.length})</h2>
          <div style={{ display: "flex", gap: "15px", overflowX: "auto", paddingBottom: "10px" }}>
            {locaisEncontrados.map((lugar, i) => (
              <div key={i} style={{ minWidth: "260px", border: "1px solid #ddd", borderRadius: "8px", padding: "14px", backgroundColor: "#fff" }}>
                <strong style={{ fontSize: "16px" }}>{lugar.title || lugar.name || "Local sem título"}</strong>
                <p style={{ margin: "6px 0", fontSize: "13px", color: "#666" }}>{lugar.address || lugar.city || "Endereço não informado"}</p>
                <div style={{ marginTop: "8px" }}>
                  <span style={{ color: "#f59e0b", fontSize: "14px", fontWeight: "bold" }}>
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
          <h2>Avaliações Extraídas ({reviewsDestaque.length})</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
            marginTop: "15px"
          }}>
            {reviewsDestaque.map((rev, index) => (
              <div key={index} style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                backgroundColor: "#fff"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{rev.name}</strong>
                  <span style={{ color: "#f59e0b", fontWeight: "bold", fontSize: "16px" }}>
                    {"★".repeat(Math.max(1, Math.min(5, rev.stars)))}
                  </span>
                </div>

                {rev.placeTitle && (
                  <span style={{ fontSize: "11px", color: "#0070f3", fontWeight: "bold", display: "block", marginTop: "4px" }}>
                    📍 {rev.placeTitle}
                  </span>
                )}

                <p style={{
                  color: rev.text.includes("sem comentário") ? "#9ca3af" : "#374151",
                  fontSize: "14px",
                  marginTop: "12px",
                  lineHeight: "1.5",
                  fontStyle: rev.text.includes("sem comentário") ? "italic" : "normal"
                }}>
                  "{rev.text}"
                </p>

                {rev.publishedAtDate && (
                  <span style={{ fontSize: "12px", color: "#9ca3af", display: "block", marginTop: "12px" }}>
                    Data: {new Date(rev.publishedAtDate).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        !carregando && (
          <div style={{ textAlign: "center", padding: "30px", color: "#6b7280", border: "2px dashed #ddd", borderRadius: "12px" }}>
            Nenhuma avaliação carregada no momento. Faça uma nova busca ou insira um Dataset ID antigo ao lado.
          </div>
        )
      )}
    </main>
  );
}