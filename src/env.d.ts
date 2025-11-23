type Env = {
	STREAK_DB?: D1Database;
	GAME_SECRET: string;
	PUBLIC_CF_BEACON_TOKEN?: string;
	SUBSCRIPTION_SALT?: string;
	IMAGE_BUCKET?: R2Bucket;
};

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}

interface ImportMetaEnv extends Env {}

interface ImportMeta { readonly env: ImportMetaEnv; }
