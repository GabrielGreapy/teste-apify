import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");
    const runId = searchParams.get("runId");

    const apiKey = process.env.APIFY_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave APIFY_API_TOKEN não configurada no .env.local" }, { status: 500 });
    }

    let targetUrl = "";
    if (datasetId) {
      targetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&clean=true`;
    } else if (runId) {
      targetUrl = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}&clean=true`;
    } else {
      return NextResponse.json({ error: "Informe datasetId ou runId na requisição" }, { status: 400 });
    }

    const response = await fetch(targetUrl);
    const items = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "Erro ao buscar dataset no Apify", details: items }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      totalItems: Array.isArray(items) ? items.length : 0,
      items: Array.isArray(items) ? items : [],
    });

  } catch (error) {
    console.error("Erro ao consultar dataset:", error);
    return NextResponse.json({ error: "Erro interno ao buscar dataset" }, { status: 500 });
  }
}