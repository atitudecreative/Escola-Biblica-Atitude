import { describe, expect, it } from "vitest";
import { seekLimit, segmentCount, watchCoverage } from "../watch";

describe("watch coverage", () => {
  it("divide o vídeo em trechos de 5s", () => {
    expect(segmentCount(60)).toBe(12);
    expect(segmentCount(61)).toBe(13);
    expect(segmentCount(0)).toBe(1);
  });

  it("pular para o final não cobre o vídeo", () => {
    expect(watchCoverage([0, 11], 60)).toBeCloseTo(2 / 12);
  });

  it("ignora trechos repetidos ou fora do vídeo", () => {
    expect(watchCoverage([0, 0, 1, 99, -1], 60)).toBeCloseTo(2 / 12);
    expect(watchCoverage([...Array(12).keys()], 60)).toBe(1);
  });

  it("limita a busca ao trecho mais adiantado já assistido (+5s)", () => {
    expect(seekLimit([])).toBe(5);
    expect(seekLimit([0, 1, 2])).toBe(20);
    expect(seekLimit([1, 2, 7])).toBe(45);
    expect(seekLimit([0], 42)).toBe(42);
  });
});
