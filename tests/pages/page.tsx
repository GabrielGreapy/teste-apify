"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: any;
  }
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  // Usamos Refs para guardar o mapa e marcador sem disparar re-renderizações infinitas
  
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // Função que cria o mapa e o autocomplete
    const initMap = () => {
      if (!window.google || googleMapRef.current) return;

      const posicaoInicial = { lat: -23.55052, lng: -46.633308 }; // São Paulo

      // 1. Cria o Mapa
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

      // 2. Conecta o Autocomplete
      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { types: ["geocode", "establishment"] }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();

          if (!place.geometry || !place.geometry.location) return;

          const novaPosicao = place.geometry.location;

          // Atualiza a visão do mapa e o pino
          if (googleMapRef.current && markerRef.current) {
            googleMapRef.current.setCenter(novaPosicao);
            googleMapRef.current.setZoom(16);
            markerRef.current.setPosition(novaPosicao);
          }
        });
      }
    };

    // Se o script do Google já existir na página, só inicializa
    if (window.google) {
      initMap();
      return;
    }

    // Se a tag do script já estiver no HTML, não insere de novo
    const scriptExistente = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (scriptExistente) {
      scriptExistente.addEventListener("load", initMap);
      return;
    }

    // Cria a tag <script> do Google Maps pela PRIMEIRA e única vez
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initMap;

    document.head.appendChild(script);
  }, []); // [] vazio garante que o useEffect rode apenas 1 vez quando a tela abre

  return (
    <main style={{ padding: "30px", textAlign: "center" }}>
      <h1>Buscador com Google Maps Oficial</h1>
      <p>Digite um endereço para centralizar o mapa:</p>

      <input
        ref={inputRef}
        type="text"
        placeholder="Digite um lugar..."
        style={{
          padding: "12px",
          width: "400px",
          fontSize: "16px",
          marginBottom: "20px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />

      <div
        ref={mapRef}
        style={{
          width: "100%",
          maxWidth: "800px",
          height: "500px",
          margin: "0 auto",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      />
    </main>
  );
}