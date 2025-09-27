export interface ProviderFormProps {
    onSubmit: (name: string, settings: Record<string, unknown>) => Promise<void>;
}
