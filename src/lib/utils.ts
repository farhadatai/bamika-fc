export const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const getYoutubeThumbnail = (url: string) => {
  const videoId = getYoutubeId(url || '');
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
};

export const TEAM_OPTIONS = [
  'Unassigned',
  'U6 Junior Academy',
  'U8 A',
  'U8 B',
  'U8 C',
  'U10 A',
  'U10 B',
  'U10 C',
  'U12 A',
  'U12 B',
  'U12 C',
  'U14 A',
  'U14 B',
  'U14 C',
  'U16 Elite',
  'Goalkeeper Group',
];
