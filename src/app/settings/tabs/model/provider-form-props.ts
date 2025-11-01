export interface ProviderFormProps {
    initialName?: string;
    initialSettings?: unknown;
    onSubmit: (name: string, settings: unknown) => Promise<void>;
}
