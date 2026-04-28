import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { GapAnalysisCard } from '@/components/ai-elements/gap-analysis-card';

const SECTIONS = [
  {
    id: 'identity',
    title: 'Identity & eligibility',
    fields: [
      { field: 'Social Security Number', inputType: 'text' as const, required: true },
    ],
  },
];

test('renders the summary CTA with Provide answers and Skip buttons', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={sendMessage} />
  );
  await expect.element(getByRole('button', { name: /provide answers/i })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
});

test('Skip for now sends a message and switches to the skipped state', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={sendMessage} />
  );
  await getByRole('button', { name: /skip for now/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  // Skipped CTA shows an enabled "Provide answers" so the user can come back.
  await expect.element(getByRole('button', { name: /provide answers/i })).toBeInTheDocument();
});

test('Provide answers opens the modal and Submit posts the answers', async () => {
  const sendMessage = vi.fn();
  const { getByRole } = render(
    <GapAnalysisCard
      formName="CalFresh"
      sections={SECTIONS}
      sendMessage={sendMessage}
    />
  );
  await getByRole('button', { name: /provide answers/i }).click();
  await getByRole('textbox').fill('123-45-6789');
  await getByRole('button', { name: /^submit$/i }).click();
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const args = sendMessage.mock.calls[0][0];
  expect(args.parts[0].text).toContain('Answers for CalFresh');
  expect(args.parts[0].text).toContain('123-45-6789');
});

test('artifact closed disables the CTA buttons', async () => {
  const { getByRole } = render(
    <GapAnalysisCard sections={SECTIONS} sendMessage={vi.fn()} isArtifactVisible={false} />
  );
  await expect.element(getByRole('button', { name: /provide answers/i })).toBeDisabled();
  await expect.element(getByRole('button', { name: /skip for now/i })).toBeDisabled();
});
