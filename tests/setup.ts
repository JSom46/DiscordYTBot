import { registerHooks } from 'node:module';
import path from 'node:path';

const virtualModules = new Map<string, { url: string; source: string }>();
let virtualModuleCounter = 0;

export function registerVirtualModule(specifier: string, source: string): void {
	virtualModuleCounter += 1;
	const entry = {
		url: `file:///virtual/${virtualModuleCounter}/${encodeURIComponent(path.basename(specifier))}`,
		source,
	};
	virtualModules.set(specifier, entry);
	virtualModules.set(path.basename(specifier), entry);
}

export function clearVirtualModules(): void {
	virtualModules.clear();
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		const virtual = virtualModules.get(specifier) ?? virtualModules.get(path.basename(specifier));
		if (virtual !== undefined) {
			return {
				url: virtual.url,
				shortCircuit: true,
			};
		}

		if (specifier.startsWith('.') && specifier.endsWith('.js')) {
			try {
				return nextResolve(specifier, context);
			} catch {
				return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
			}
		}

		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (url.startsWith('file:///virtual/')) {
			const specifier = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
			const virtual = virtualModules.get(specifier);
			if (virtual !== undefined) {
				return {
					format: 'module',
					source: virtual.source,
					shortCircuit: true,
				};
			}
		}

		return nextLoad(url, context);
	},
});
