import { z } from "zod";
import { GrowthPlan } from "@admetrics/domain";

// --- Schemas do Estúdio Criativo & Ativos de Aquisição ---

export const ReelsScriptSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  durationEstimateSeconds: z.number().int().min(10).max(60),
  hook: z.string().min(5), // Primeiros 3 segundos
  pain: z.string().min(5), // A dor do dia a dia
  solution: z.string().min(5), // Como o produto resolve
  cta: z.string().min(5), // Chamada para ação
  visualDirections: z.array(z.string()).min(1) // O que filmar na prática
});
export type ReelsScript = z.infer<typeof ReelsScriptSchema>;

export const GoogleKeywordSchema = z.object({
  keyword: z.string().min(2),
  matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
  estimatedIntent: z.enum(["HIGH_PURCHASE", "SOLUTION_SEARCH", "COMPARISON"])
});
export type GoogleKeyword = z.infer<typeof GoogleKeywordSchema>;

export const GoogleSearchAdGroupSchema = z.object({
  adGroupName: z.string().min(1),
  theme: z.string().min(1),
  keywords: z.array(GoogleKeywordSchema).min(1),
  headlines: z.array(z.string().max(30)).min(3), // Limite oficial do Google Ads: 30 chars
  descriptions: z.array(z.string().max(90)).min(2) // Limite oficial do Google Ads: 90 chars
});
export type GoogleSearchAdGroup = z.infer<typeof GoogleSearchAdGroupSchema>;

export const LandingPageSectionSchema = z.object({
  headline: z.string().min(5),
  subheadline: z.string().min(5),
  ctaButtonText: z.string().min(2),
  benefitBullets: z.array(z.string()).min(2),
  socialProofAngle: z.string().min(5),
  faq: z.array(z.object({
    question: z.string().min(5),
    answer: z.string().min(5)
  })).min(2)
});
export type LandingPageSection = z.infer<typeof LandingPageSectionSchema>;

export const OutboundMessageSchema = z.object({
  channel: z.enum(["whatsapp", "instagram_dm", "email"]),
  angle: z.string().min(1),
  messageTemplate: z.string().min(10)
});
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

export const ColdStartAssetPackageSchema = z.object({
  productName: z.string(),
  reelsScripts: z.array(ReelsScriptSchema).min(1),
  googleSearchCampaign: z.array(GoogleSearchAdGroupSchema).min(1),
  landingPage: LandingPageSectionSchema,
  outboundMessages: z.array(OutboundMessageSchema).min(1),
  generatedAt: z.string()
});
export type ColdStartAssetPackage = z.infer<typeof ColdStartAssetPackageSchema>;

// --- Motor Gerador Ancorado em ICP & Dores de Mercado ---

export interface GenerateAssetsInput {
  productName: string;
  businessModel: string;
  valueProposition: string;
  targetAudience: string;
  painPoints: string[];
  mainDifferentiator: string;
  monthlyPrice?: number;
  productUrl?: string;
}

/**
 * Gera um pacote completo de criativos e campanhas de partida a frio (Cold Start)
 * ancorado no perfil do produto e nas dores reais do cliente.
 */
export function generateColdStartAssets(input: GenerateAssetsInput): ColdStartAssetPackage {
  const isHardwareRepair = input.productName.toLowerCase().includes("torx") ||
    input.targetAudience.toLowerCase().includes("assistência") ||
    input.targetAudience.toLowerCase().includes("conserto") ||
    input.targetAudience.toLowerCase().includes("reparo");

  const reelsScripts: ReelsScript[] = [];
  const googleSearchCampaign: GoogleSearchAdGroup[] = [];
  let landingPage: LandingPageSection;
  const outboundMessages: OutboundMessage[] = [];

  if (isHardwareRepair) {
    // 1. Roteiros de Reels para Assistências Técnicas / Hardware
    reelsScripts.push({
      id: "reels_script_01_whatsapp",
      title: "O Fim do 'Meu Celular Tá Pronto?' no WhatsApp",
      durationEstimateSeconds: 25,
      hook: "Você ainda perde tempo avisando cliente no WhatsApp manualmente?",
      pain: "A bancada cheia de aparelho, você tentando consertar e o cliente mandando mensagem a cada meia hora perguntando se ficou pronto.",
      solution: `Com o ${input.productName}, quando o técnico altera o status para 'Pronto', o cliente recebe a OS no WhatsApp na mesma hora.`,
      cta: "Teste 14 dias grátis sem colocar cartão. Link no perfil.",
      visualDirections: [
        "Cena 1 (0-3s): Close no técnico com chave de fenda e celular vibrando sem parar ao lado.",
        "Cena 2 (3-12s): Tela do TorxOS mudando status para 'Finalizado'.",
        "Cena 3 (12-20s): Celular do cliente recebendo a notificação automática e comprovante em PDF.",
        "Cena 4 (20-25s): Logo do TorxOS com botão 'Começar Teste Grátis'."
      ]
    });

    reelsScripts.push({
      id: "reels_script_02_estoque",
      title: "Peça Sumindo da Bancada Nunca Mais",
      durationEstimateSeconds: 20,
      hook: "Já perdeu dinheiro porque usou uma tela e esqueceu de cobrar?",
      pain: "Peça sai da gaveta, entra no aparelho, ninguém anota e no fim do mês o lucro sumiu.",
      solution: `No ${input.productName}, a peça só entra na bancada vinculada à Ordem de Serviço e baixa o estoque no ato.`,
      cta: "Pare de perder peças. Comece seu teste gratuito no link da bio.",
      visualDirections: [
        "Cena 1: Gaveta de componentes desorganizada ou bancada cheia de caixas.",
        "Cena 2: Tela do sistema mostrando baixa automática e margem de lucro por serviço.",
        "Cena 3: Técnico dando joinha com a bancada organizada."
      ]
    });

    // 2. Grupos de Anúncios no Google Search (Alta Intenção de Compra)
    googleSearchCampaign.push({
      adGroupName: "Software para Assistência Técnica - Busca Exata",
      theme: "Sistemas e Gestão de Assistência",
      keywords: [
        { keyword: "sistema para assistencia tecnica", matchType: "EXACT", estimatedIntent: "HIGH_PURCHASE" },
        { keyword: "software ordem de servico celular", matchType: "EXACT", estimatedIntent: "HIGH_PURCHASE" },
        { keyword: "programa para conserto de celular", matchType: "EXACT", estimatedIntent: "HIGH_PURCHASE" },
        { keyword: "sistema os eletronica", matchType: "PHRASE", estimatedIntent: "SOLUTION_SEARCH" }
      ],
      headlines: [
        "Sistema p/ Assistência Técnica", // 30 chars
        "OS Digital via WhatsApp",         // 23 chars
        "Controle de Peças e Estoque",     // 27 chars
        "Teste Grátis por 14 Dias",       // 24 chars
        "Organize sua Assistência Já"     // 27 chars
      ],
      descriptions: [
        "Envie a OS no WhatsApp do cliente automaticamente e controle suas peças sem erro.", // 83 chars
        "O sistema mais rápido para conserto de celulares, notebooks e eletrônicos. Teste grátis.", // 89 chars
        "Emita orçamentos profissionais em segundos e aumente o faturamento da sua bancada." // 83 chars
      ]
    });

    // 3. Estrutura de Alta Conversão para Landing Page
    landingPage = {
      headline: "O Sistema Operacional que a sua Assistência Técnica precisa para lucrar mais.",
      subheadline: "Centralize ordens de serviço com aviso automático no WhatsApp, controle estoque de peças e acabe com a bagunça na bancada.",
      ctaButtonText: "Começar Teste Grátis de 14 Dias",
      benefitBullets: [
        "Notificação de OS no WhatsApp: O cliente sabe o status do reparo sem você precisar digitar.",
        "Controle de Peças Blindado: Saiba exatamente onde cada componente foi aplicado e seu lucro real.",
        "IA Mentor Integrado: Auxílio inteligente para agilizar orçamentos e diagnóstico técnico.",
        "Orçamentos Rápidos: Emissão de comprovantes profissionais que passam confiança ao cliente."
      ],
      socialProofAngle: "Desenvolvido especificamente para a rotina real de quem trabalha com manutenção e reparo.",
      faq: [
        {
          question: "Preciso cadastrar cartão de crédito para testar?",
          answer: "Não! Você cria sua conta e usa gratuitamente por 14 dias sem compromisso."
        },
        {
          question: "Como funciona a OS no WhatsApp?",
          answer: "Assim que você abre ou atualiza a ordem de serviço na bancada, o TorxOS envia uma mensagem personalizada com link para o cliente acompanhar."
        },
        {
          question: "Funciona para conserto de videogame e informática?",
          answer: "Sim. O TorxOS é completo para celulares, computadores, consoles e eletroeletrônicos."
        }
      ]
    };

    // 4. Mensagens Outbound Consultivas (Custo Zero / Google Maps)
    outboundMessages.push({
      channel: "whatsapp",
      angle: "Abordagem Consultiva para Donos de Loja no Google Maps",
      messageTemplate: "Olá! Tudo bem? Vi a assistência de vocês no Google. Vocês ainda avisam os clientes sobre o conserto manualmente no WhatsApp ou usam algum sistema que já envia a notificação automática da OS? Estamos liberando acesso gratuito para assistências da região testarem o TorxOS. Se fizer sentido, te mostro em 3 minutos como funciona."
    });

    outboundMessages.push({
      channel: "instagram_dm",
      angle: "Abordagem Direta no Instagram de Técnicos",
      messageTemplate: "Fala mestre! Trabalho top na bancada de vocês. Uma dúvida rápida: vocês usam algum software que avisa o cliente no WhatsApp quando o aparelho tá pronto ou ainda fazem na mão? Criamos o TorxOS focado nisso e queria te liberar um acesso de teste sem custo. Topa dar uma olhada?"
    });

  } else {
    // Fallback inteligente para qualquer outro SaaS / Produto B2B
    reelsScripts.push({
      id: "reels_script_generic_b2b",
      title: `Resolvendo a Maior Dor de ${input.targetAudience}`,
      durationEstimateSeconds: 30,
      hook: `Se você ainda perde tempo com ${input.painPoints[0] || "processos manuais"}, veja isso.`,
      pain: `Todo profissional de ${input.targetAudience} sofre quando precisa lidar com problemas repetitivos.`,
      solution: `O ${input.productName} automatiza tudo isso com ${input.mainDifferentiator}.`,
      cta: "Clique no link e comece seu teste gratuito hoje mesmo.",
      visualDirections: [
        "Cena 1: Mostrando o problema na prática.",
        "Cena 2: Tela do software resolvendo com 1 clique.",
        "Cena 3: Chamada para ação final."
      ]
    });

    googleSearchCampaign.push({
      adGroupName: `Software para ${input.targetAudience}`,
      theme: "Solução e Automação B2B",
      keywords: [
        { keyword: `sistema para ${input.targetAudience.toLowerCase().slice(0, 30)}`, matchType: "PHRASE", estimatedIntent: "HIGH_PURCHASE" },
        { keyword: `software ${input.productName.toLowerCase()}`, matchType: "EXACT", estimatedIntent: "SOLUTION_SEARCH" }
      ],
      headlines: [
        `${input.productName} Oficial`.slice(0, 30),
        "Software Especializado".slice(0, 30),
        "Teste Grátis 14 Dias".slice(0, 30)
      ],
      descriptions: [
        `Conheça o ${input.productName} e transforme a rotina da sua empresa hoje mesmo.`.slice(0, 90),
        "Aumente sua produtividade e reduza custos operacionais com nossa plataforma.".slice(0, 90)
      ]
    });

    landingPage = {
      headline: `${input.productName}: A solução definitiva para ${input.targetAudience}.`,
      subheadline: input.valueProposition,
      ctaButtonText: "Começar Teste Gratuito",
      benefitBullets: input.painPoints.length > 0 ? input.painPoints.map(p => `Elimina: ${p}`) : ["Mais eficiência", "Menos retrabalho"],
      socialProofAngle: "Projetado por quem entende o seu mercado.",
      faq: [
        {
          question: "Como funciona o período de teste?",
          answer: "Você pode experimentar todas as funcionalidades sem pagar nada inicialmente."
        },
        {
          question: "Preciso de treinamento para usar?",
          answer: "A interface é simples e intuitiva, você começa a usar no mesmo dia."
        }
      ]
    };

    outboundMessages.push({
      channel: "whatsapp",
      angle: "Apresentação Consultiva B2B",
      messageTemplate: `Olá! Notei o trabalho excelente da sua equipe com ${input.targetAudience}. Desenvolvemos o ${input.productName} para resolver ${input.painPoints[0] || "gargalos operacionais"}. Posso te enviar uma demonstração rápida de 2 minutos?`
    });
  }

  const generatedPackage: ColdStartAssetPackage = {
    productName: input.productName,
    reelsScripts,
    googleSearchCampaign,
    landingPage,
    outboundMessages,
    generatedAt: new Date().toISOString()
  };

  // Validação estrita via Zod antes de retornar
  return ColdStartAssetPackageSchema.parse(generatedPackage);
}
