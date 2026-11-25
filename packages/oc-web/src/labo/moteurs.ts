// Deux moteurs d'IA locale, chargés seulement quand on les utilise (import dynamique) :
// - WebLLM (WebGPU, Apache-2.0) : rapide si le téléphone a WebGPU.
// - wllama (llama.cpp en WebAssembly, MIT) : fonctionne sans WebGPU, sur le processeur.
// Le modèle est téléchargé UNE fois (Internet, ou serveur local de l'école), puis gardé
// dans le stockage du navigateur. Ensuite tout fonctionne en mode avion.

export type Source = 'internet' | 'serveur' | 'fichier';

export interface Candidat {
  id: string;
  nom: string;
  moteur: 'webllm' | 'wllama';
  /** WebLLM : id du modèle dans la liste de WebLLM. wllama : URL du GGUF sur Hugging Face. */
  ref: string;
  licence: string;
  note: string;
}

// Les tailles et la qualité réelles sont MESURÉES par cette page sur le téléphone.
export const CANDIDATS: Candidat[] = [
  { id: 'qwen3-0.6b-webllm', nom: 'Qwen3 0.6B (q4f16)', moteur: 'webllm', ref: 'Qwen3-0.6B-q4f16_1-MLC', licence: 'Apache-2.0', note: 'Le plus léger. Arabe et français pris en charge (119 langues annoncées). Mémoire GPU annoncée par WebLLM : 1403 Mo.' },
  { id: 'qwen3-1.7b-webllm', nom: 'Qwen3 1.7B (q4f16)', moteur: 'webllm', ref: 'Qwen3-1.7B-q4f16_1-MLC', licence: 'Apache-2.0', note: 'Meilleure qualité attendue en maths et en arabe. Mémoire GPU annoncée : 2037 Mo.' },
  { id: 'qwen2.5-1.5b-webllm', nom: 'Qwen2.5 1.5B Instruct (q4f16)', moteur: 'webllm', ref: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', licence: 'Apache-2.0', note: 'Génération précédente, très testée. Mémoire GPU annoncée : 1630 Mo.' },
  { id: 'qwen2.5-0.5b-wllama', nom: 'Qwen2.5 0.5B Instruct Q4_K_M (sans WebGPU)', moteur: 'wllama', ref: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf', licence: 'Apache-2.0', note: 'Pour les téléphones sans WebGPU. Lent sur processeur ; qualité limitée.' },
  { id: 'qwen3-0.6b-wllama', nom: 'Qwen3 0.6B Q8_0 (sans WebGPU)', moteur: 'wllama', ref: 'https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf', licence: 'Apache-2.0', note: 'Pour les téléphones sans WebGPU.' },
];

export interface Generation {
  texte: string;
  tokens: number;
  ms: number;
  msPremierToken: number;
}

export interface Moteur {
  generer(question: string, onTexte: (t: string) => void): Promise<Generation>;
  decharger(): Promise<void>;
}

export interface ProgresChargement {
  (fraction: number, texte: string): void;
}

const sansReflexion = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim();

/** Adresse des modèles sur le serveur local de l'école (même origine que l'application). */
const baseServeur = () => new URL('/modeles/', location.href).href;

export async function chargerWebLLM(c: Candidat, source: Source, progres: ProgresChargement, systeme: string): Promise<Moteur> {
  const webllm = await import('@mlc-ai/web-llm');
  const rec = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === c.ref);
  if (!rec) throw new Error(`Modèle inconnu de WebLLM : ${c.ref}`);
  let appConfig = webllm.prebuiltAppConfig;
  if (source === 'serveur') {
    const lib = rec.model_lib.split('/').pop()!;
    appConfig = { ...appConfig, model_list: [{ ...rec, model: baseServeur() + c.ref + '/', model_lib: baseServeur() + 'libs/' + lib }] };
  }
  const engine = await webllm.CreateMLCEngine(c.ref, {
    appConfig,
    initProgressCallback: (r) => progres(r.progress, r.text),
  });
  const qwen3 = /Qwen3/.test(c.ref);
  return {
    async generer(question, onTexte) {
      const t0 = performance.now();
      let premier = 0, texte = '', tokens = 0;
      const flux = await engine.chat.completions.create({
        messages: [{ role: 'system', content: systeme }, { role: 'user', content: question }],
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.3,
        max_tokens: 256,
        ...(qwen3 ? { extra_body: { enable_thinking: false } } : {}),
      });
      for await (const ch of flux) {
        const d = ch.choices[0]?.delta?.content ?? '';
        if (d && !premier) premier = performance.now() - t0;
        texte += d;
        if (ch.usage) tokens = ch.usage.completion_tokens;
        onTexte(sansReflexion(texte));
      }
      return { texte: sansReflexion(texte), tokens, ms: performance.now() - t0, msPremierToken: premier };
    },
    async decharger() { await engine.unload(); },
  };
}

export async function chargerWllama(c: Candidat, source: Source, progres: ProgresChargement, systeme: string, fichier?: File): Promise<Moteur> {
  const { Wllama } = await import('@wllama/wllama');
  const wasm = (await import('@wllama/wllama/esm/wasm/wllama.wasm?url')).default;
  const w = new Wllama({ default: wasm }, { allowOffline: true, suppressNativeLog: true });
  const params = { n_ctx: 2048, progressCallback: ({ loaded, total }: { loaded: number; total: number }) => progres(total ? loaded / total : 0, `${Math.round(loaded / 1e6)} / ${Math.round(total / 1e6)} Mo`) };
  if (source === 'fichier') {
    if (!fichier) throw new Error('Choisissez un fichier .gguf');
    await w.loadModel([fichier], { n_ctx: 2048 });
  } else {
    const url = source === 'serveur' ? baseServeur() + c.ref.split('/').pop() : c.ref;
    await w.loadModelFromUrl(url, params);
  }
  return {
    async generer(question, onTexte) {
      const t0 = performance.now();
      let premier = 0, texte = '', tokens = 0;
      await w.createChatCompletion({
        messages: [{ role: 'system', content: systeme }, { role: 'user', content: /Qwen3/i.test(c.ref) ? question + ' /no_think' : question }],
        temperature: 0.3,
        max_tokens: 256,
        stream: true,
        onData: (ch) => {
          const d = ch.choices[0]?.delta?.content ?? '';
          if (d) { if (!premier) premier = performance.now() - t0; tokens++; }
          texte += d;
          onTexte(sansReflexion(texte));
        },
      });
      return { texte: sansReflexion(texte), tokens, ms: performance.now() - t0, msPremierToken: premier };
    },
    async decharger() { await w.exit(); },
  };
}
