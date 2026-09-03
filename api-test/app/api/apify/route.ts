import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    console.log("1. Recebendo pedido do frontend...");
    const body = await req.json();
    console.log("2. Dados recebidos:", body);
    
    const apiKey = process.env.NEXT_APIFY_KEY;

    if (!apiKey) {
      console.error("ERRO: A variável APIFY_API_KEY não foi encontrada no .env.local");
      return NextResponse.json({ error: "Chave do Apify ausente" }, { status: 500 });
    }

    // URL original usando "acts" (para Actors). 
    const apifyUrl = `https://api.apify.com/v2/acts/AabCualFIriz3X6Fs/runs?token=${apiKey}`;
    
    // ATENÇÃO: Se AabCualFIriz3X6Fs for uma "Task" (uma configuração salva), a URL correta seria:
    // const apifyUrl = `https://api.apify.com/v2/actor-tasks/AabCualFIriz3X6Fs/runs?token=${apiKey}`;

    console.log("3. Chamando Apify em:", apifyUrl.replace(apiKey, "CHAVE_OCULTA***"));

   // ... código anterior ...
    console.log("3. Chamando Apify em:", apifyUrl.replace(apiKey, "CHAVE_OCULTA***"));

    const response = await fetch(apifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchStringsArray: [body.searchString],
        locationQuery: body.locationQuery,
        maxCrawledPlacesPerSearch: Number(body.maxPlaces),
        maxReviews: Number(body.maxReviews), // <-- NOVO: Quantidade de reviews
        language: body.language,
        reviewsSort: body.reviewsSort,
      }),
    });
    // ... resto do código ...

    // Em vez de forçar o JSON, lemos como texto primeiro para não quebrar
    const textResponse = await response.text();
    console.log("4. Resposta bruta do Apify:", textResponse);

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (err) {
      console.error("ERRO: O Apify não retornou um JSON válido.");
      return NextResponse.json({ error: "Resposta estranha do Apify", details: textResponse }, { status: 500 });
    }

    if (!response.ok) {
      console.error("ERRO RECUSADO PELO APIFY:", data);
      return NextResponse.json({ error: "O Apify recusou o pedido", details: data }, { status: response.status });
    }

    console.log("5. Sucesso! ID da raspagem:", data.data.id);
    return NextResponse.json({ success: true, runId: data.data.id });

  } catch (error) {
    console.error("ERRO CRÍTICO NO BACKEND:", error);
    return NextResponse.json({ error: "Erro interno no servidor", details: String(error) }, { status: 500 });
  }
}