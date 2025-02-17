import { PrismaClient } from '@prisma/client';
import { create } from 'xmlbuilder2';


// todo probably import this. I bet it already exists. 
const prisma = new PrismaClient();


// TODO we need to update this, but this gives a mapping for our prisma data into XML.
// I think ideally we should statically build this whenever a new episode is added or deleted.. that way load times are super fast,
// and we don't have to hit our db every time? IDK.

async function generatePodcastRSS(podcastId: string): Promise<string> {
  // Fetch podcast and its episodes from Prisma
  const podcast = await prisma.podcast.findUnique({
    where: { id: podcastId },
    include: { episodes: true },
  });

  if (!podcast) {
    throw new Error(`Podcast with ID ${podcastId} not found`);
  }

  // Build the RSS XML
  const rss = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rss', { version: '2.0', 'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd' })
    .ele('channel')
    .ele('title').txt(podcast.title).up()
    .ele('link').txt(podcast.link).up()
    .ele('description').txt(podcast.description).up()
    .ele('language').txt(podcast.language).up()
    .ele('copyright').txt(podcast.copyright).up()
    .ele('lastBuildDate').txt(new Date(podcast.lastBuildDate).toUTCString()).up()
    .ele('generator').txt(podcast.generator).up()
    .ele('itunes:image', { href: podcast.imageUrl }).up()
    .ele('itunes:author').txt(podcast.author).up()
    .ele('itunes:owner')
    .ele('name').txt(podcast.owner).up()
    .up()
    .ele('itunes:explicit').txt(podcast.explicit ? 'yes' : 'no').up()
    .ele('itunes:type').txt(podcast.type).up()
    .ele('itunes:category').txt(podcast.category).up();

  // Add episodes
  for (const episode of podcast.episodes) {
    rss.ele('item')
      .ele('title').txt(episode.title).up()
      .ele('description').txt(episode.description).up()
      .ele('link').txt(episode.link).up()
      .ele('enclosure', {
        url: episode.audioUrl,
        length: episode.audioSize.toString(),
        type: episode.audioType,
      }).up()
      .ele('guid', { isPermaLink: 'false' }).txt(episode.guid).up()
      .ele('pubDate').txt(new Date(episode.pubDate).toUTCString()).up()
      .ele('itunes:duration').txt(episode.duration.toString()).up()
      .ele('itunes:episodeType').txt(episode.episodeType).up()
      .ele('itunes:episode').txt(episode.episode.toString()).up()
      .ele('itunes:explicit').txt(episode.explicit ? 'yes' : 'no').up()
      .ele('itunes:image', { href: episode.imageUrl }).up();

    if (episode.transcriptUrl) {
      rss.ele('podcast:transcript', {
        url: episode.transcriptUrl,
        type: 'application/x-subrip',
      }).up();
    }

    rss.up(); // Close the <item> tag
  }

  // Convert the XML object to a string
  return rss.end({ prettyPrint: true });
}

// Example usage
(async () => {
  try {
    const rssXml = await generatePodcastRSS('your-podcast-id');
    console.log(rssXml);
  } catch (error) {
    console.error('Error generating RSS:', error);
  } finally {
    await prisma.$disconnect();
  }
})();