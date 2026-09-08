import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const apiKey = process.env.APIFY_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave APIFY_API_TOKEN não configurada no .env.local" }, { status: 500 });
    }

    const actorId = "nwua9Gu5YrADL7ZDj";
    const apifyUrl = `https://api.apify.com/v2/actors/${actorId}/runs?token=${apiKey}`;

    // Payload otimizado para extração de locais e avaliações do Google Maps
    const inputPayload = {
      searchStringsArray: [body.searchString],
      locationQuery: body.locationQuery,
      maxCrawledPlacesPerSearch: Number(body.maxPlaces) || 5,
      maxReviews: Number(body.maxReviews) || 20,
      scrapeReviews: true,
      oneReviewPerRow: body.oneReviewPerRow ?? true, // Recomendo true para extrair reviews completas
      reviewsSort: body.reviewsSort || "newest",
      language: body.language || "pt-BR",
    };

    console.log("Iniciando raspagem no Apify com payload:", inputPayload);

    const response = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro retornado pelo Apify:", data);
      return NextResponse.json({ error: "Erro ao iniciar raspagem no Apify", details: data }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      runId: data.data.id,
      datasetId: data.data.defaultDatasetId,
    });

  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}