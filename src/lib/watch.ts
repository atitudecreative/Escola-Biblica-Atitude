/**
 * Regras de "aula assistida" (isomórfico: player e servidor).
 * O vídeo é dividido em trechos de 5s; um trecho só conta quando é reproduzido de fato.
 * Pular para o final não cobre os trechos do meio, e o servidor limita quantos trechos
 * novos podem chegar pelo tempo real decorrido — então não dá para "acelerar" pela rede.
 */
export const SEGMENT_SECONDS = 5;
/** Parte do vídeo que precisa ser assistida para concluir (tolera créditos/finais). */
export const COMPLETE_RATIO = 0.9;
/** Velocidade máxima do player; usada no limite de trechos por tempo real. */
export const MAX_PLAYBACK_RATE = 2;

export function segmentCount(durationSeconds: number) {
  return Math.max(1, Math.ceil(durationSeconds / SEGMENT_SECONDS));
}

/** Fração (0–1) do vídeo coberta pelos trechos assistidos. */
export function watchCoverage(segments: Iterable<number>, durationSeconds: number) {
  const total = segmentCount(durationSeconds);
  let n = 0;
  for (const s of new Set(segments)) if (s >= 0 && s < total) n++;
  return Math.min(1, n / total);
}

/**
 * Até onde o aluno pode avançar na barra: o fim do trecho mais adiantado que ele já assistiu
 * (+ um trecho de margem). Como um trecho só conta quando é reproduzido, o limite só cresce assistindo.
 */
export function seekLimit(segments: Iterable<number>, positionSeconds = 0) {
  let furthest = -1;
  for (const s of segments) if (s > furthest) furthest = s;
  return Math.max((furthest + 2) * SEGMENT_SECONDS, positionSeconds);
}
