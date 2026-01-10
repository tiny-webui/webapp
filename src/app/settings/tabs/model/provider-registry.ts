export const AVAILABLE_PROVIDERS = [
  'AzureOpenAI',
  'OpenAI',
] as const;

export type ProviderKey = typeof AVAILABLE_PROVIDERS[number];

const providerIconMap: Record<string, string> = {
  default: '/providerIcons/default.png',
  AzureOpenAI: '/providerIcons/Azure-OpenAI.svg',
  OpenAI: '/providerIcons/OpenAI.svg',
};

const providerDisplayNameMap: Record<string, string> = {
  AzureOpenAI: 'Azure OpenAI',
  OpenAI: 'OpenAI',
};

export function getProviderIcon(providerName: string): string {
  return providerIconMap[providerName] ?? providerIconMap.default;
}

export function getProviderDisplayName(providerName: string): string {
  return providerDisplayNameMap[providerName] ?? providerName;
}
