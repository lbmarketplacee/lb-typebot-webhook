// Webhook do Typebot — recebe os dados de um lead preenchido no bot e cria ele no CRM do sistema.
// Configuração necessária na Vercel: variável de ambiente FIREBASE_SERVICE_ACCOUNT (mesma chave já usada nos outros projetos).
//
// Como usar no Typebot: adicione um bloco "Webhook" no final do fluxo, método POST,
// URL: https://lb-typebot-webhook.vercel.app/api/lead
// Body (JSON), mapeando as variáveis do seu bot, por exemplo:
// { "nome": "{{Nome}}", "whatsapp": "{{WhatsApp}}", "email": "{{Email}}", "instagram": "{{Instagram}}" }

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getDb(){
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const body = req.body || {};
    // Aceita os nomes de campo mais comuns que o Typebot costuma mandar — ajuste conforme as variáveis do seu bot
    const nome = body.nome || body.name || body.Nome || '';
    const whatsapp = body.whatsapp || body.telefone || body.phone || body.WhatsApp || '';
    const email = body.email || body.Email || '';
    const instagram = body.instagram || body.Instagram || '';
    const nicho = body.nicho || body.Nicho || '';
    const tipoServico = body.tipoServico || body.tipo_servico || '';

    if (!nome.trim()) {
      return res.status(400).json({ erro: 'Campo "nome" é obrigatório.' });
    }

    // Qualquer outro campo que o Typebot mandar (fora os já mapeados acima) é
    // capturado automaticamente aqui, sem precisar mexer no código depois.
    const CAMPOS_JA_MAPEADOS = new Set([
      'nome','name','Nome',
      'whatsapp','telefone','phone','WhatsApp',
      'email','Email',
      'instagram','Instagram',
      'nicho','Nicho',
      'tipoServico','tipo_servico'
    ]);
    const respostasExtras = {};
    for (const chave in body) {
      if (!CAMPOS_JA_MAPEADOS.has(chave) && body[chave] !== undefined && body[chave] !== null && String(body[chave]).trim() !== '') {
        respostasExtras[chave] = String(body[chave]).trim();
      }
    }

    // Monta um texto legível com as respostas extras para já aparecer nas Notas do card do lead
    let notasTexto = 'Lead recebido automaticamente via Typebot.';
    const chavesExtras = Object.keys(respostasExtras);
    if (chavesExtras.length > 0) {
      const linhasExtras = chavesExtras.map(chave => `• ${chave}: ${respostasExtras[chave]}`).join('\n');
      notasTexto += '\n\nRespostas do Typebot:\n' + linhasExtras;
    }

    const db = getDb();
    const novoLead = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      instagram: instagram.trim(),
      nicho: nicho.trim(),
      nichoOutro: '',
      tipoServico: tipoServico.trim(),
      origem: 'Typebot',
      valor: 0,
      notas: notasTexto,
      respostasTypebot: respostasExtras,
      stage: 'novo',
      criadoEm: FieldValue.serverTimestamp(),
      createdDate: new Date().toISOString().slice(0, 10)
    };

    const ref = await db.collection('crmLeads').add(novoLead);
    return res.status(200).json({ ok: true, id: ref.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: 'Erro interno: ' + (e.message || 'desconhecido') });
  }
}
