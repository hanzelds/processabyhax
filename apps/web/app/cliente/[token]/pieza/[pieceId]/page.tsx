import { redirect } from 'next/navigation'

// Deep link — redirect to main portal with an anchor to the specific piece.
// The piece detail is embedded in the main portal; scrolling/expansion is handled client-side.

interface Props {
  params: Promise<{ token: string; pieceId: string }>
}

export default async function PieceDeepLinkPage({ params }: Props) {
  const { token } = await params
  redirect(`/cliente/${token}#piezas`)
}
