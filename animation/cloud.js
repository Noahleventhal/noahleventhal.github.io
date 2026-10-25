import {normalizeProject} from './project.js';
export class CloudRepository {
  constructor(config,{clientFactory}={}) {this.config=config;this.clientFactory=clientFactory;this.revision=0;this.admin=null;}
  get configured(){return !!(this.config?.supabaseUrl&&this.config?.supabasePublishableKey);}
  async connect(){
    if(!this.configured)return;
    const url=new URL(this.config.supabaseUrl),key=this.config.supabasePublishableKey;
    if(url.protocol!=='https:'||key.startsWith('sb_secret_'))throw new Error('Use an HTTPS project URL and a public publishable key.');
    if(key.split('.').length===3){try{if(JSON.parse(atob(key.split('.')[1])).role!=='anon')throw new Error('Private API keys must never be used in the website.');}catch(error){throw new Error('A valid publishable key is required.');}}
    const createClient=this.clientFactory||(await import('../vendor/supabase.js')).createClient;
    this.client=createClient(this.config.supabaseUrl,key,{global:{fetch:(input,options)=>fetch(input,{...options,cache:'no-store'})},auth:{persistSession:true,storage:globalThis.sessionStorage,detectSessionInUrl:false,autoRefreshToken:true}});
  }
  async publication(){if(!this.client)return null;const{data,error}=await this.client.from('workbook_publications').select('document,revision').eq('site_id',this.config.siteId).maybeSingle();if(error)throw error;return data?{project:normalizeProject(data.document),revision:data.revision}:null;}
  async verifyAdmin(){
    const {data,error}=await this.client.auth.getUser();if(error||!data?.user){this.admin=null;return null;}
    const result=await this.client.from('workbook_admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(result.error)throw result.error;
    this.admin=result.data?data.user:null;return this.admin;
  }
  async signIn(email,password){const result=await this.client.auth.signInWithPassword({email,password});if(result.error)throw new Error('Sign-in failed. Check your email and password.');const admin=await this.verifyAdmin();if(!admin){await this.client.auth.signOut();throw new Error('This account does not have administrator access.');}return admin;}
  async signOut(){if(this.client)await this.client.auth.signOut();this.admin=null;this.revision=0;}
  async draft(){if(!await this.verifyAdmin())throw new Error('Administrator access is required.');const{data,error}=await this.client.from('workbook_drafts').select('document,revision').eq('site_id',this.config.siteId).maybeSingle();if(error)throw error;this.revision=data?.revision||0;return data?normalizeProject(data.document):null;}
  async save(project){if(!await this.verifyAdmin())throw new Error('Your session has expired. Sign in again.');const{data,error}=await this.client.rpc('save_workbook_draft',{p_site_id:this.config.siteId,p_document:normalizeProject(project),p_expected_revision:this.revision});if(error){if(error.message?.includes('revision'))throw new Error('This draft changed on another device. Reload the cloud draft before saving.');throw error;}this.revision=Number(data);return this.revision;}
  async publish(){if(!await this.verifyAdmin())throw new Error('Administrator access is required.');const{data,error}=await this.client.rpc('publish_workbook',{p_site_id:this.config.siteId,p_expected_revision:this.revision});if(error)throw error;return data;}
}
