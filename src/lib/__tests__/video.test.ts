import { describe, expect, it } from "vitest";
import { embedUrl, pandaEmbedUrl, previewEmbedUrl } from "../video";

const ID = "bb0ea4cd-6c1e-4e2b-9bd5-7d6f5b5b9d46";
const EMBED = `https://player-vz-7b6cf9e4-8bf.tv.pandavideo.com.br/embed/?v=${ID}`;

describe("pandaEmbedUrl", () => {
  it("normaliza o link de embed", () => {
    expect(pandaEmbedUrl(`${EMBED}&foo=1`)).toBe(EMBED);
  });
  it("extrai o src do código <iframe> (com &amp;)", () => {
    const iframe = `<iframe id="panda-x" src="${EMBED}&amp;autoplay=false" style="border:none;" allow="autoplay" allowfullscreen=true width="720" height="360"></iframe>`;
    expect(pandaEmbedUrl(iframe)).toBe(EMBED);
  });
  it("aceita o domínio .com", () => {
    expect(pandaEmbedUrl(`https://player-abc.tv.pandavideo.com/embed/?v=${ID}`)).toBe(`https://player-abc.tv.pandavideo.com/embed/?v=${ID}`);
  });
  it("recusa hosts falsos, http e ids inválidos", () => {
    expect(pandaEmbedUrl(`https://player-x.tv.pandavideo.com.br.evil.com/embed/?v=${ID}`)).toBeNull();
    expect(pandaEmbedUrl(`https://evil.com/?u=player-x.tv.pandavideo.com.br&v=${ID}`)).toBeNull();
    expect(pandaEmbedUrl(`http://player-x.tv.pandavideo.com.br/embed/?v=${ID}`)).toBeNull();
    expect(pandaEmbedUrl(`https://player-x.tv.pandavideo.com.br/embed/?v=<script>`)).toBeNull();
    expect(pandaEmbedUrl("")).toBeNull();
  });
});

describe("embeds", () => {
  it("player e prévia do Panda", () => {
    expect(embedUrl("PANDA", EMBED)).toBe(EMBED);
    expect(previewEmbedUrl("PANDA", EMBED)).toContain("muted=true");
    expect(previewEmbedUrl("PANDA", EMBED)).toContain("smartAutoplay=false&mutedIndicatorIcon=false");
  });
  it("YouTube e Vimeo continuam iguais", () => {
    expect(embedUrl("YOUTUBE", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
    expect(embedUrl("VIMEO", "https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
  });
});
