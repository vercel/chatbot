import { useLocalStorage } from 'usehooks-ts';
import { isProductionEnvironment } from '@/lib/constants';

export function useModelOverride(): { body: { modelOverride: string } } | undefined {
  const [selectedModelId] = useLocalStorage<string>('selected-chat-model-id', '');

  if (isProductionEnvironment || !selectedModelId) return undefined;

  return { body: { modelOverride: selectedModelId } };
}
