"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: any;
  }
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [apifyConfig, setApifyConfig] = useState({
    searchString: "Restaurantes",
    locationQuery: "",
    maxPlaces: 10,
    maxReviews: 50, // <-- NOVO: Padrão de 50 reviews (coloque 9999 para pegar todas)
    language: "pt-BR",
    reviewsSort: "newest"
  });

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    const initMap = () => {
      if (!window.google || googleMapRef.current) return;

      const posicaoInicial = { lat: -23.55052, lng: -46.633308 };

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
    const { name, value } = e.target;
    setApifyConfig((prev) => ({ ...prev, [name]: value }));
  };

  const buscarNoApify = async () => {
    if (!apifyConfig.locationQuery || !apifyConfig.searchString) {
      alert("Por favor, garanta que a categoria e o local estejam preenchidos!");
      return;
    }

    try {
      const response = await fetch('/api/apify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyConfig),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        alert("Erro de Rota 404: O Next.js não encontrou a sua API (route.ts).");
        return;
      }

      const data = await response.json();

      if (response.ok) {
        alert(`Sucesso! Raspagem iniciada no Apify.\nID do Processo: ${data.runId}\n(O Apify agora está puxando os locais e as avaliações!)`);
      } else {
        alert(`Falha ao iniciar raspagem: ${data.error}`);
        console.error("Detalhes:", data);
      }
    } catch (error) {
      alert("Erro crítico ao conectar com a nossa API.");
      console.error(error);
    }
  };

  return (
    <main style={{ padding: "30px", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>Buscador Integrado: Google Maps + Apify</h1>
      
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

      <div style={{ display: "flex", gap: "20px", maxWidth: "1200px", margin: "0 auto", alignItems: "flex-start" }}>
        
        <aside style={{
          width: "300px", backgroundColor: "#f8f9fa", padding: "20px",
          borderRadius: "12px", border: "1px solid #ddd", boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <h3 style={{ marginTop: 0 }}>Extrator do Google Maps</h3>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}>Configurações da Raspagem</p>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>O que buscar? (Categoria):</label>
            <input 
              type="text" name="searchString" value={apifyConfig.searchString} onChange={handleApifyChange}
              placeholder="Ex: Pizzaria, Hotel..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>Onde? (Local):</label>
            <input 
              type="text" name="locationQuery" value={apifyConfig.locationQuery} onChange={handleApifyChange}
              placeholder="Pesquise no mapa ao lado..."
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "#e9ecef" }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>Máximo de Locais:</label>
            <input 
              type="number" name="maxPlaces" value={apifyConfig.maxPlaces} onChange={handleApifyChange} min="10"
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>

          {/* NOVO CAMPO: MÁXIMO DE AVALIAÇÕES */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>Máximo de Avaliações (por local):</label>
            <input 
              type="number" name="maxReviews" value={apifyConfig.maxReviews} onChange={handleApifyChange} min="0"
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", borderColor: "#10a37f" }}
            />
            <small style={{ color: "#666", fontSize: "11px" }}>Use 9999 para pegar todas (pode demorar).</small>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>Ordenar Avaliações:</label>
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
            style={{
              width: "100%", padding: "10px", backgroundColor: "#10a37f", color: "white",
              border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer"
            }}
          >
            Iniciar Raspagem no Apify
          </button>
        </aside>

        <div
          ref={mapRef}
          style={{
            flex: 1, height: "600px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        />
      </div>
    </main>
  );
}