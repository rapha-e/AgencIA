import { z } from "zod";
export declare const ReelsScriptSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    durationEstimateSeconds: z.ZodNumber;
    hook: z.ZodString;
    pain: z.ZodString;
    solution: z.ZodString;
    cta: z.ZodString;
    visualDirections: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    id: string;
    durationEstimateSeconds: number;
    hook: string;
    pain: string;
    solution: string;
    cta: string;
    visualDirections: string[];
}, {
    title: string;
    id: string;
    durationEstimateSeconds: number;
    hook: string;
    pain: string;
    solution: string;
    cta: string;
    visualDirections: string[];
}>;
export type ReelsScript = z.infer<typeof ReelsScriptSchema>;
export declare const GoogleKeywordSchema: z.ZodObject<{
    keyword: z.ZodString;
    matchType: z.ZodEnum<["EXACT", "PHRASE", "BROAD"]>;
    estimatedIntent: z.ZodEnum<["HIGH_PURCHASE", "SOLUTION_SEARCH", "COMPARISON"]>;
}, "strip", z.ZodTypeAny, {
    keyword: string;
    matchType: "EXACT" | "PHRASE" | "BROAD";
    estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
}, {
    keyword: string;
    matchType: "EXACT" | "PHRASE" | "BROAD";
    estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
}>;
export type GoogleKeyword = z.infer<typeof GoogleKeywordSchema>;
export declare const GoogleSearchAdGroupSchema: z.ZodObject<{
    adGroupName: z.ZodString;
    theme: z.ZodString;
    keywords: z.ZodArray<z.ZodObject<{
        keyword: z.ZodString;
        matchType: z.ZodEnum<["EXACT", "PHRASE", "BROAD"]>;
        estimatedIntent: z.ZodEnum<["HIGH_PURCHASE", "SOLUTION_SEARCH", "COMPARISON"]>;
    }, "strip", z.ZodTypeAny, {
        keyword: string;
        matchType: "EXACT" | "PHRASE" | "BROAD";
        estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
    }, {
        keyword: string;
        matchType: "EXACT" | "PHRASE" | "BROAD";
        estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
    }>, "many">;
    headlines: z.ZodArray<z.ZodString, "many">;
    descriptions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    adGroupName: string;
    theme: string;
    keywords: {
        keyword: string;
        matchType: "EXACT" | "PHRASE" | "BROAD";
        estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
    }[];
    headlines: string[];
    descriptions: string[];
}, {
    adGroupName: string;
    theme: string;
    keywords: {
        keyword: string;
        matchType: "EXACT" | "PHRASE" | "BROAD";
        estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
    }[];
    headlines: string[];
    descriptions: string[];
}>;
export type GoogleSearchAdGroup = z.infer<typeof GoogleSearchAdGroupSchema>;
export declare const LandingPageSectionSchema: z.ZodObject<{
    headline: z.ZodString;
    subheadline: z.ZodString;
    ctaButtonText: z.ZodString;
    benefitBullets: z.ZodArray<z.ZodString, "many">;
    socialProofAngle: z.ZodString;
    faq: z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        answer: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        question: string;
        answer: string;
    }, {
        question: string;
        answer: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    headline: string;
    subheadline: string;
    ctaButtonText: string;
    benefitBullets: string[];
    socialProofAngle: string;
    faq: {
        question: string;
        answer: string;
    }[];
}, {
    headline: string;
    subheadline: string;
    ctaButtonText: string;
    benefitBullets: string[];
    socialProofAngle: string;
    faq: {
        question: string;
        answer: string;
    }[];
}>;
export type LandingPageSection = z.infer<typeof LandingPageSectionSchema>;
export declare const OutboundMessageSchema: z.ZodObject<{
    channel: z.ZodEnum<["whatsapp", "instagram_dm", "email"]>;
    angle: z.ZodString;
    messageTemplate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    channel: "whatsapp" | "instagram_dm" | "email";
    angle: string;
    messageTemplate: string;
}, {
    channel: "whatsapp" | "instagram_dm" | "email";
    angle: string;
    messageTemplate: string;
}>;
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;
export declare const ColdStartAssetPackageSchema: z.ZodObject<{
    productName: z.ZodString;
    reelsScripts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        durationEstimateSeconds: z.ZodNumber;
        hook: z.ZodString;
        pain: z.ZodString;
        solution: z.ZodString;
        cta: z.ZodString;
        visualDirections: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        id: string;
        durationEstimateSeconds: number;
        hook: string;
        pain: string;
        solution: string;
        cta: string;
        visualDirections: string[];
    }, {
        title: string;
        id: string;
        durationEstimateSeconds: number;
        hook: string;
        pain: string;
        solution: string;
        cta: string;
        visualDirections: string[];
    }>, "many">;
    googleSearchCampaign: z.ZodArray<z.ZodObject<{
        adGroupName: z.ZodString;
        theme: z.ZodString;
        keywords: z.ZodArray<z.ZodObject<{
            keyword: z.ZodString;
            matchType: z.ZodEnum<["EXACT", "PHRASE", "BROAD"]>;
            estimatedIntent: z.ZodEnum<["HIGH_PURCHASE", "SOLUTION_SEARCH", "COMPARISON"]>;
        }, "strip", z.ZodTypeAny, {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }, {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }>, "many">;
        headlines: z.ZodArray<z.ZodString, "many">;
        descriptions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        adGroupName: string;
        theme: string;
        keywords: {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }[];
        headlines: string[];
        descriptions: string[];
    }, {
        adGroupName: string;
        theme: string;
        keywords: {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }[];
        headlines: string[];
        descriptions: string[];
    }>, "many">;
    landingPage: z.ZodObject<{
        headline: z.ZodString;
        subheadline: z.ZodString;
        ctaButtonText: z.ZodString;
        benefitBullets: z.ZodArray<z.ZodString, "many">;
        socialProofAngle: z.ZodString;
        faq: z.ZodArray<z.ZodObject<{
            question: z.ZodString;
            answer: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            question: string;
            answer: string;
        }, {
            question: string;
            answer: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        headline: string;
        subheadline: string;
        ctaButtonText: string;
        benefitBullets: string[];
        socialProofAngle: string;
        faq: {
            question: string;
            answer: string;
        }[];
    }, {
        headline: string;
        subheadline: string;
        ctaButtonText: string;
        benefitBullets: string[];
        socialProofAngle: string;
        faq: {
            question: string;
            answer: string;
        }[];
    }>;
    outboundMessages: z.ZodArray<z.ZodObject<{
        channel: z.ZodEnum<["whatsapp", "instagram_dm", "email"]>;
        angle: z.ZodString;
        messageTemplate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        channel: "whatsapp" | "instagram_dm" | "email";
        angle: string;
        messageTemplate: string;
    }, {
        channel: "whatsapp" | "instagram_dm" | "email";
        angle: string;
        messageTemplate: string;
    }>, "many">;
    generatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    productName: string;
    reelsScripts: {
        title: string;
        id: string;
        durationEstimateSeconds: number;
        hook: string;
        pain: string;
        solution: string;
        cta: string;
        visualDirections: string[];
    }[];
    googleSearchCampaign: {
        adGroupName: string;
        theme: string;
        keywords: {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }[];
        headlines: string[];
        descriptions: string[];
    }[];
    landingPage: {
        headline: string;
        subheadline: string;
        ctaButtonText: string;
        benefitBullets: string[];
        socialProofAngle: string;
        faq: {
            question: string;
            answer: string;
        }[];
    };
    outboundMessages: {
        channel: "whatsapp" | "instagram_dm" | "email";
        angle: string;
        messageTemplate: string;
    }[];
    generatedAt: string;
}, {
    productName: string;
    reelsScripts: {
        title: string;
        id: string;
        durationEstimateSeconds: number;
        hook: string;
        pain: string;
        solution: string;
        cta: string;
        visualDirections: string[];
    }[];
    googleSearchCampaign: {
        adGroupName: string;
        theme: string;
        keywords: {
            keyword: string;
            matchType: "EXACT" | "PHRASE" | "BROAD";
            estimatedIntent: "HIGH_PURCHASE" | "SOLUTION_SEARCH" | "COMPARISON";
        }[];
        headlines: string[];
        descriptions: string[];
    }[];
    landingPage: {
        headline: string;
        subheadline: string;
        ctaButtonText: string;
        benefitBullets: string[];
        socialProofAngle: string;
        faq: {
            question: string;
            answer: string;
        }[];
    };
    outboundMessages: {
        channel: "whatsapp" | "instagram_dm" | "email";
        angle: string;
        messageTemplate: string;
    }[];
    generatedAt: string;
}>;
export type ColdStartAssetPackage = z.infer<typeof ColdStartAssetPackageSchema>;
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
export declare function generateColdStartAssets(input: GenerateAssetsInput): ColdStartAssetPackage;
//# sourceMappingURL=creative-studio.d.ts.map