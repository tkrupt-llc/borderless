import { StartButton } from "./start-button";

export async function StartFollowUp({ params }: { params: PageProps<"/f/[token]">["params"] }) {
  const { token } = await params;
  return <StartButton token={token} />;
}
