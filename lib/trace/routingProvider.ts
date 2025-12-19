import { z } from "zod";

const routingPointSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
});

export type RoutingPoint = z.infer<typeof routingPointSchema>;

const routingResponseSchema = z.object({
  coordinates: z.array(
    z.object({
      lat: z.number().finite(),
      lng: z.number().finite(),
    })
  ),
  distance: z.number().nonnegative().optional(),
});

export type RoutingResponse = z.infer<typeof routingResponseSchema>;

const ROUTING_BASE_URL = process.env.NEXT_PUBLIC_ROUTING_API_URL ?? "https://api.openrouteservice.org/v2/directions/foot-hiking";
const ROUTING_API_KEY = process.env.NEXT_PUBLIC_ROUTING_API_KEY;

export const requestRoutedPath = async (points: RoutingPoint[]): Promise<RoutingResponse> => {
  const parsed = z.array(routingPointSchema).min(2).safeParse(points);

  if (!parsed.success) {
    return routingResponseSchema.parse({ coordinates: points });
  }

  if (!ROUTING_API_KEY) {
    return routingResponseSchema.parse({ coordinates: points });
  }

  try {
    const body = {
      coordinates: parsed.data.map((point) => [point.lng, point.lat]),
    };

    const response = await fetch(ROUTING_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ROUTING_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Routing provider returned non-OK response", await response.text());
      return routingResponseSchema.parse({ coordinates: points });
    }

    const data = (await response.json().catch(() => null)) as unknown;
    const parsedData = z
      .object({
        features: z
          .array(
            z.object({
              geometry: z.object({
                coordinates: z.array(z.array(z.number())),
              }),
              properties: z.object({
                summary: z.object({ distance: z.number().nonnegative() }).optional(),
              }),
            })
          )
          .min(1),
      })
      .safeParse(data);

    if (!parsedData.success) {
      console.error("Unable to parse routing response", parsedData.error.flatten().fieldErrors);
      return routingResponseSchema.parse({ coordinates: points });
    }

    const [firstFeature] = parsedData.data.features;
    const coords = firstFeature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return routingResponseSchema.parse({
      coordinates: coords,
      distance: firstFeature.properties.summary?.distance,
    });
  } catch (error) {
    console.error("Unexpected routing provider error", error);
    return routingResponseSchema.parse({ coordinates: points });
  }
};
