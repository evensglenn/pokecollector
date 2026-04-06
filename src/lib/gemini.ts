import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface PricePoint {
  month: string;
  price: number;
}

export interface IdentifiedCard {
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  type: string;
  hp?: string;
  stage: string;
  year: string;
  weakness?: string;
  resistance?: string;
  retreatCost?: string;
  evolutionInfo: string;
  estimatedValue: number;
  priceHistory: PricePoint[];
}

export async function identifyCard(base64Image: string): Promise<IdentifiedCard> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `Identificeer deze Pokemon kaart. Geef de volgende details in JSON-formaat:
            - name: Naam van de Pokemon
            - setName: Naam van de uitbreidingsset
            - cardNumber: Kaartnummer (bijv. 12/102)
            - rarity: Zeldzaamheid (bijv. Common, Rare, Holo Rare)
            - type: Pokemon type (bijv. Fire, Water)
            - hp: HP van de Pokemon (indien van toepassing)
            - stage: Fase van de kaart (bijv. Basis, Fase 1, VMAX, GX)
            - year: Jaartal van de kaart (meestal onderaan de kaart te vinden)
            - weakness: Zwakte (bijv. Water x2)
            - resistance: Weerstand (bijv. Fighting -20)
            - retreatCost: Terugtrekkosten (bijv. 2 Energie)
            - evolutionInfo: Korte info over de evolutiefase in het Nederlands (bijv. Evolueert van Charmander)
            - estimatedValue: Gemiddelde marktwaarde in EUR (alleen het getal)
            - priceHistory: Een array van 6 objecten met 'month' (bijv. 'Jan', 'Feb') en 'price' (getal in EUR) die de prijsontwikkeling van de afgelopen 6 maanden weergeven.
            
            Geef ALLEEN het JSON-object terug.`,
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          setName: { type: Type.STRING },
          cardNumber: { type: Type.STRING },
          rarity: { type: Type.STRING },
          type: { type: Type.STRING },
          hp: { type: Type.STRING },
          stage: { type: Type.STRING },
          year: { type: Type.STRING },
          weakness: { type: Type.STRING },
          resistance: { type: Type.STRING },
          retreatCost: { type: Type.STRING },
          evolutionInfo: { type: Type.STRING },
          estimatedValue: { type: Type.NUMBER },
          priceHistory: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                month: { type: Type.STRING },
                price: { type: Type.NUMBER },
              },
              required: ["month", "price"],
            },
          },
        },
        required: ["name", "setName", "cardNumber", "priceHistory", "year"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function fetchCardDetailsByText(name: string, setName: string, cardNumber: string, year: string): Promise<Partial<IdentifiedCard>> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Geef de details voor de volgende Pokemon kaart: ${name} uit de set ${setName} met nummer ${cardNumber} uit het jaar ${year}.
    Geef de volgende details in JSON-formaat:
    - rarity: Zeldzaamheid
    - type: Pokemon type
    - hp: HP
    - stage: Fase
    - weakness: Zwakte
    - resistance: Weerstand
    - retreatCost: Terugtrekkosten
    - evolutionInfo: Evolutie info in het Nederlands
    - estimatedValue: Gemiddelde marktwaarde in EUR (getal)
    - priceHistory: Array van 6 objecten met 'month' en 'price' (getal in EUR)
    
    Geef ALLEEN het JSON-object terug.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rarity: { type: Type.STRING },
          type: { type: Type.STRING },
          hp: { type: Type.STRING },
          stage: { type: Type.STRING },
          weakness: { type: Type.STRING },
          resistance: { type: Type.STRING },
          retreatCost: { type: Type.STRING },
          evolutionInfo: { type: Type.STRING },
          estimatedValue: { type: Type.NUMBER },
          priceHistory: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                month: { type: Type.STRING },
                price: { type: Type.NUMBER },
              },
              required: ["month", "price"],
            },
          },
        },
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
