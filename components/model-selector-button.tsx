'use client';

import { useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from './ai-elements/model-selector';
import { isProductionEnvironment } from '@/lib/constants';

type ModelOption = {
  id: string;
  name: string;
  provider: string;
};

const MODEL_GROUPS: Array<{ name: string; models: ModelOption[] }> = [
  {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', provider: 'openai' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'openai' },
    ],
  },
  {
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' },
    ],
  },
];

type ModelSelectorButtonProps = {
  onModelChange?: (model: ModelOption) => void;
};

export function ModelSelectorButton({ onModelChange }: ModelSelectorButtonProps = {}) {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useLocalStorage<ModelOption>(
    'selected-chat-model',
    MODEL_GROUPS[0].models[0],
  );

  if (isProductionEnvironment) return null;

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 h-fit px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-accent hover:text-foreground transition-colors"
        >
          <ModelSelectorLogo provider={selectedModel.provider} />
          <span>{selectedModel.name}</span>
          <ChevronDown className="size-3" />
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {MODEL_GROUPS.map((group, i) => (
            <div key={group.name}>
              {i > 0 && <div className="h-px bg-border mx-1 my-1" />}
              <ModelSelectorGroup heading={group.name}>
                {group.models.map((model) => (
                  <ModelSelectorItem
                    key={model.id}
                    value={model.name}
                    onSelect={() => {
                      setSelectedModel(model);
                      onModelChange?.(model);
                      setOpen(false);
                    }}
                  >
                    <ModelSelectorLogo provider={model.provider} />
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            </div>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}
