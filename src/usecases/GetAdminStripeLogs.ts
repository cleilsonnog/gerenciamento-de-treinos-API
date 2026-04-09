import { stripe } from "../lib/stripe.js";

interface InputDto {
  type?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  startingAfter?: string;
}

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: Record<string, unknown>;
}

interface OutputDto {
  events: StripeEvent[];
  hasMore: boolean;
}

export class GetAdminStripeLogs {
  async execute(dto: InputDto): Promise<OutputDto> {
    const params: Record<string, unknown> = {
      limit: dto.limit,
    };

    if (dto.type) {
      params.type = dto.type;
    }

    if (dto.startDate) {
      params.created = {
        ...(params.created as Record<string, unknown> | undefined),
        gte: Math.floor(new Date(dto.startDate).getTime() / 1000),
      };
    }

    if (dto.endDate) {
      params.created = {
        ...(params.created as Record<string, unknown> | undefined),
        lte: Math.floor(new Date(dto.endDate).getTime() / 1000),
      };
    }

    if (dto.startingAfter) {
      params.starting_after = dto.startingAfter;
    }

    const events = await stripe.events.list(params);

    return {
      events: events.data.map((event) => ({
        id: event.id,
        type: event.type,
        created: event.created,
        data: event.data as unknown as Record<string, unknown>,
      })),
      hasMore: events.has_more,
    };
  }
}
