import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

// Preview images for shared links: text only, in the site's light theme. The board images may only be shown as a quote
// at their vote, so they are never a preview.
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export type OgImageContent = {
  title: string;
  lines: string[];
  // The result of a vote, coloured like on the site; always named in words.
  outcome?: { text: string; accepted: boolean };
};

const COLORS = {
  surface: '#ffffff',
  text: '#1c2430',
  muted: '#4f5866',
  primary: '#1f5fbf',
  accepted: '#1a7f3c',
  rejected: '#c52b2b',
};

const fontFile = (weight: number) =>
  readFileSync(
    join(
      process.cwd(),
      'node_modules/@fontsource/dm-sans/files',
      `dm-sans-latin-${weight}-normal.woff`,
    ),
  );
const fonts = [
  {
    name: 'DM Sans',
    data: fontFile(400),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'DM Sans',
    data: fontFile(700),
    weight: 700 as const,
    style: 'normal' as const,
  },
];

type Node = { type: string; props: Record<string, unknown> };
const element = (
  type: string,
  style: Record<string, unknown>,
  children: unknown,
): Node => ({
  type,
  props: { style, children },
});

export async function renderOgImage(content: OgImageContent): Promise<Buffer> {
  const titleSize =
    content.title.length > 110 ? 44 : content.title.length > 60 ? 52 : 64;
  const tree = element(
    'div',
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: COLORS.surface,
      color: COLORS.text,
      fontFamily: 'DM Sans',
    },
    [
      element(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
          padding: '60px 72px 52px',
        },
        [
          element('div', { display: 'flex', flexDirection: 'column', gap: 6 }, [
            element(
              'div',
              { fontSize: 30, fontWeight: 700, color: COLORS.primary },
              'StadtratWatch Leipzig',
            ),
            element(
              'div',
              { fontSize: 22, color: COLORS.muted },
              'Wie jedes Mitglied der Leipziger Ratsversammlung abstimmt',
            ),
          ]),
          element(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              width: '100%',
            },
            [
              element(
                'div',
                {
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  width: '100%',
                  display: 'block',
                  lineClamp: 3,
                },
                content.title,
              ),
              ...content.lines.map((line) =>
                element('div', { fontSize: 30, color: COLORS.muted }, line),
              ),
              ...(content.outcome
                ? [
                    element(
                      'div',
                      {
                        fontSize: 34,
                        fontWeight: 700,
                        color: content.outcome.accepted
                          ? COLORS.accepted
                          : COLORS.rejected,
                      },
                      content.outcome.text,
                    ),
                  ]
                : []),
            ],
          ),
        ],
      ),
      element(
        'div',
        { width: OG_IMAGE_WIDTH, height: 14, backgroundColor: COLORS.primary },
        '',
      ),
    ],
  );
  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });
  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}
