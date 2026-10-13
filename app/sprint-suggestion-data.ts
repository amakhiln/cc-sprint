// Create Sprint pre-fill for app/(pm)/sprint/page.tsx and app/(pm)/page.tsx
// -- both render the Create Sprint form when no Sprint is active.
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { youTrackConfigRepository, getAgileBoardId } from "@/infrastructure/youtrack/config";
import { youTrackSprintsAdapter } from "@/infrastructure/youtrack/sprints";
import { selectableSprints, type SprintSuggestion } from "@/domain/youtrack";

// Pull-on-render pre-fill for Create Sprint (YouTrack has no sprint-created
// webhook). Never blocks: unset board -> no suggestion, failure -> a note.
export async function loadSprintSuggestion(): Promise<{ suggestion: SprintSuggestion | null; loadFailed: boolean }> {
  const boardId = getAgileBoardId();
  const config = boardId ? await youTrackConfigRepository.get() : null;
  if (!boardId || !config) return { suggestion: null, loadFailed: false };
  try {
    const [result, importedIds] = await Promise.all([
      youTrackSprintsAdapter.listSprints(config, boardId),
      sprintRepository.listImportedYouTrackIds(),
    ]);
    if (!result.ok) return { suggestion: null, loadFailed: true };
    return { suggestion: selectableSprints(result.data, importedIds, new Date())[0] ?? null, loadFailed: false };
  } catch (error) {
    console.error("loadSprintSuggestion failed:", error);
    return { suggestion: null, loadFailed: true };
  }
}
