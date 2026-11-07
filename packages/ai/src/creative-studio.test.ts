import test from "node:test";
import assert from "node:assert/strict";
import {
  generateColdStartAssets,
  ColdStartAssetPackageSchema
} from "./creative-studio.js";

test("deve gerar pacote de criativos de partida a frio para o TorxOS com regras estritas", () => {
  const result = generateColdStartAssets({
    productName: "TorxOS",
    businessModel: "b2b_saas",
    valueProposition: "Sistema operacional para centros de reparo de hardware e assistência técnica.",
    targetAudience: "Donos de assistências de celulares, computadores e eletrônicos.",
    painPoints: [
      "Cliente cobrando status no WhatsApp toda hora",
      "Peças sumindo do estoque",
      "Anotação de OS em papel ou planilhas desorganizadas"
    ],
    mainDifferentiator: "OS Digital com notificação automática via WhatsApp a cada etapa do conserto.",
    monthlyPrice: 97.00,
    productUrl: "https://torxos.tech"
  });

  // 1. Validar que o schema Zod foi aprovado
  const parsed = ColdStartAssetPackageSchema.safeParse(result);
  assert.equal(parsed.success, true);

  // 2. Validar que possui roteiros de Reels
  assert.equal(result.reelsScripts.length >= 2, true);
  const reels1 = result.reelsScripts[0];
  assert.equal(reels1.hook.includes("WhatsApp"), true);
  assert.equal(reels1.visualDirections.length >= 3, true);

  // 3. Validar conformidade estrita com os limites de caracteres do Google Ads
  assert.equal(result.googleSearchCampaign.length >= 1, true);
  const adGroup = result.googleSearchCampaign[0];

  adGroup.headlines.forEach((h, idx) => {
    assert.equal(
      h.length <= 30,
      true,
      `Headline ${idx + 1} "${h}" excede o limite de 30 caracteres do Google Ads (possui ${h.length})`
    );
  });

  adGroup.descriptions.forEach((d, idx) => {
    assert.equal(
      d.length <= 90,
      true,
      `Description ${idx + 1} "${d}" excede o limite de 90 caracteres do Google Ads (possui ${d.length})`
    );
  });

  // 4. Validar Landing Page e Outbound
  assert.equal(result.landingPage.headline.length > 10, true);
  assert.equal(result.landingPage.benefitBullets.length >= 4, true);
  assert.equal(result.outboundMessages.length >= 2, true);
  assert.equal(result.outboundMessages[0].channel, "whatsapp");
});

test("deve gerar pacote genérico funcional para outro SaaS B2B", () => {
  const result = generateColdStartAssets({
    productName: "AgroFlow",
    businessModel: "b2b_saas",
    valueProposition: "Gestão financeira para produtores rurais.",
    targetAudience: "Produtores rurais e cooperativas agrícolas.",
    painPoints: ["Controle em cadernos", "Dificuldade em fluxo de caixa"],
    mainDifferentiator: "Aplicativo offline com conciliação bancária automática."
  });

  const parsed = ColdStartAssetPackageSchema.safeParse(result);
  assert.equal(parsed.success, true);
  assert.equal(result.productName, "AgroFlow");
  assert.equal(result.reelsScripts.length >= 1, true);
});
