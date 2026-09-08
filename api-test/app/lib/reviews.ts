export interface Review {
  id?: string;
  name?: string;
  text?: string;
  stars?: number;
  publishedAtDate?: string;
  likesCount?: number;
  reviewImageUrls?: string[];
}

export function extrairMelhoresReviews(lugares: any[], limite = 6): Review[] {
  let todasReviews: Review[] = [];

  // 1. Extrai todas as reviews contidas nos lugares raspados
  lugares.forEach((lugar) => {
    if (lugar.reviews && Array.isArray(lugar.reviews)) {
      todasReviews.push(...lugar.reviews);
    } else if (lugar.text || lugar.stars) {
      // Caso a raspagem tenha sido configurada como 1 linha por review
      todasReviews.push(lugar);
    }
  });

  // 2. Filtra e Pontua as avaliações
  const reviewsComPontuacao = todasReviews
    .filter((rev) => rev.text && rev.text.trim().length > 15) // Apenas com texto significativo
    .map((rev) => {
      let pontuacao = 0;
      
      // Estrelas
      if (rev.stars === 5) pontuacao += 50;
      else if (rev.stars === 4) pontuacao += 30;

      // Tamanho do comentário (detalhamento)
      if (rev.text && rev.text.length > 100) pontuacao += 20;

      // Curtidas do comentário
      if (rev.likesCount) pontuacao += rev.likesCount * 10;

      return { review: rev, score: pontuacao };
    });

  // 3. Ordena da maior pontuação para a menor
  reviewsComPontuacao.sort((a, b) => b.score - a.score);

  // 4. Retorna apenas as 'limite' melhores
  return reviewsComPontuacao.slice(0, limite).map((item) => item.review);
}