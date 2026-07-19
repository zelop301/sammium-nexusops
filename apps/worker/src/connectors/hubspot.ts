import type { CanonicalEvent } from '@nexus/contracts';
import { config } from '../config.js';

const baseUrl = 'https://api.hubapi.com';

async function hubspotFetch(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`HubSpot ${response.status}: ${body.message ?? text}`);
  return body;
}

export async function upsertHubSpotContact(event: CanonicalEvent, actionConfig: Record<string, unknown>) {
  const email = typeof event.data.email === 'string' ? event.data.email : null;
  if (!email || !config.HUBSPOT_ACCESS_TOKEN) {
    return {
      mode: 'simulated',
      provider: 'hubspot',
      message: email ? 'No HubSpot token configured.' : 'Event has no customer email.',
      contact: { email, lifecycleStage: actionConfig.lifecycleStage ?? 'customer' }
    };
  }

  const search = await hubspotFetch('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email', 'firstname', 'lastname', 'lifecyclestage'],
      limit: 1
    })
  });

  const properties = {
    email,
    firstname: String(event.data.firstName ?? ''),
    lastname: String(event.data.lastName ?? ''),
    lifecyclestage: String(actionConfig.lifecycleStage ?? 'customer')
  };

  if (search.results?.[0]?.id) {
    const contact = await hubspotFetch(`/crm/v3/objects/contacts/${search.results[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
    return { mode: 'connected', operation: 'updated', contactId: contact.id };
  }

  const contact = await hubspotFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties })
  });
  return { mode: 'connected', operation: 'created', contactId: contact.id };
}
