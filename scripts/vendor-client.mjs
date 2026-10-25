import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:new URL('../',import.meta.url).pathname},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:new URL('../vendor/supabase.js',import.meta.url).pathname,legalComments:'eof'});
