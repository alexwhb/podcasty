// app/routes/podcast/$podcastId/episodes/$episodeId/edit.tsx
import { json, redirect } from "@remix-run/server-runtime";
import { prisma } from "#app/utils/db.server.ts";
import { Form, Link, useActionData, useLoaderData, useParams } from "react-router";

// Custom invariant function (replacing tiny-invariant)
function invariant(condition: any, message: string = "Invariant failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// Import our UI components (adjust these paths as needed)
import { Input } from "#app/components/ui/input.tsx";
import { Textarea } from "#app/components/ui/textarea.tsx";
import { Label } from "#app/components/ui/label.tsx";
import { Button } from "#app/components/ui/button.tsx";
import * as Switch from "@radix-ui/react-switch";

// Simple input validator – you can expand this as needed.
function validateEpisode({ title, description, pubDate }: { title: string; description: string; pubDate: string; }) {
  const errors: Record<string, string> = {};
  if (!title.trim()) errors.title = "Title is required.";
  if (!description.trim()) errors.description = "Description is required.";
  if (!pubDate) errors.pubDate = "Publish date is required.";
  return errors;
}

interface LoaderData {
  episode: {
    id: string;
    title: string;
    description: string;
    pubDate: string;
    explicit: boolean;
  };
}

export async function loader({ params }: { params: { podcastId: string; episodeId: string } }) {
  invariant(params.episodeId, "episodeId is required");
  const episode = await prisma.episode.findUnique({
    where: { id: params.episodeId },
  });
  if (!episode) {
    throw new Response("Episode not found", { status: 404 });
  }
  return json({ episode });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { podcastId: string; episodeId: string };
}) {
  invariant(params.episodeId, "episodeId is required");
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const pubDate = formData.get("pubDate") as string;
  // With our toggle switch we represent "true" as "on"
  const explicit = formData.get("explicit") === "on";

  const errors = validateEpisode({ title, description, pubDate });
  if (Object.keys(errors).length > 0) {
    // Return errors as JSON with status 400
    return json({ errors }, { status: 400 });
  }

  await prisma.episode.update({
    where: { id: params.episodeId },
    data: {
      title,
      description,
      pubDate: new Date(pubDate),
      explicit,
    },
  });

  return redirect(`/podcast/${params.podcastId}/episodes`);
}

export default function EditEpisode() {
  const { episode } = useLoaderData<LoaderData>();
  const { podcastId } = useParams();
  const actionData = useActionData<{ errors?: Record<string, string> }>();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Edit Episode</h1>
      <Form method="post" className="space-y-6">
        {/* Title Field using our Radiax-style TextField */}
        <Input
          name="title"
          id="title"

          defaultValue={episode.title}

          autoFocus
          className="mt-1 block w-full"
        />

        {/* Description Field using our Radiax-style TextareaField */}
        <Textarea
          name="description"
          id="description"

          defaultValue={episode.description}
          rows={4}
//          error={actionData?.errors?.description}
          className="mt-1 block w-full"
        />

        {/* Publish Date Field using our Radiax-style Input */}
        <Input
          name="pubDate"
          id="pubDate"

          type="date"
          defaultValue={new Date(episode.pubDate).toISOString().split("T")[0]}
//          error={actionData?.errors?.pubDate}
          className="mt-1 block w-full"
        />

        {/* Explicit Field Using Radix Switch as a Toggle */}
        <div className="flex items-center space-x-2">
          <Label htmlFor="explicit">Explicit</Label>
          <Switch.Root
            name="explicit"
            id="explicit"
            defaultChecked={episode.explicit}
            className="h-6 w-11 rounded-full bg-gray-200 relative inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Switch.Thumb
              className="block h-5 w-5 rounded-full bg-white shadow-md transition-transform transform translate-x-0 data-[state=checked]:translate-x-5"
            />
          </Switch.Root>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button type="submit" variant="default">
            Save Changes
          </Button>
          <Link
            to={`/podcast/${podcastId}/episodes`}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}
