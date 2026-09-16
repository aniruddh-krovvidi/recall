// Local sentence embeddings via transformers.js. The model (~23 MB, int8)
// is downloaded once into data/models and loaded lazily on first use.
import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
export const DIMS = 384;

env.cacheDir = process.env.RECALL_MODEL_DIR ?? "data/models";

let extractor: Promise<FeatureExtractionPipeline> | undefined;

function load(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline("feature-extraction", MODEL, { dtype: "q8" });
  return extractor;
}

export async function embed(texts: string[], batchSize = 32): Promise<number[][]> {
  const ex = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const t = await ex(texts.slice(i, i + batchSize), { pooling: "mean", normalize: true });
    out.push(...(t.tolist() as number[][]));
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0]!;
}
