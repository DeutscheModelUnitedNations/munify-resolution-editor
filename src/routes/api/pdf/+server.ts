import { resolutionToTypst } from '$lib/res-markup';
import { unEmblemSvg } from '$lib/assets/un-emblem';
import { ResolutionSchema, type ResolutionHeaderData } from '$lib/schema/resolution';
import { error } from '@sveltejs/kit';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { RequestHandler } from './$types';

const TYPST_BIN = join(process.cwd(), 'node_modules/.bin/typst');

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const parsed = ResolutionSchema.safeParse((body as { resolution?: unknown })?.resolution);
	if (!parsed.success) throw error(400, 'Invalid resolution data');

	const header: ResolutionHeaderData = (body as { header?: ResolutionHeaderData })?.header ?? {};

	const dir = mkdtempSync(join(tmpdir(), 'mun-'));
	try {
		const emblemPath = 'emblem.svg';
		writeFileSync(join(dir, emblemPath), unEmblemSvg);

		const source = resolutionToTypst(parsed.data, header, { emblemPath });
		writeFileSync(join(dir, 'resolution.typ'), source);

		execFileSync(TYPST_BIN, ['compile', 'resolution.typ', 'resolution.pdf'], {
			cwd: dir,
			timeout: 30_000
		});

		const pdf = readFileSync(join(dir, 'resolution.pdf'));
		return new Response(pdf, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'attachment; filename="resolution.pdf"'
			}
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw error(500, `Typst compilation failed: ${msg}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};
