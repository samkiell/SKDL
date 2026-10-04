"""Verify full v3 flow: movie + series episode + subtitles, end-to-end."""
import asyncio
from moviebox_api.v3.http_client import MovieBoxHttpClient
from moviebox_api.v3.core import (
    Search, SeasonDetails, DownloadableFilesDetail, DownloadableCaptionFileDetails,
)
from moviebox_api.v3.helpers import get_download_tv_series_request_params
from moviebox_api.v3.constants import SubjectType, CustomResolutionType


async def resolve_movie(client, title):
    s = Search(client, query=title, subject_type=SubjectType.MOVIES, per_page=10)
    res = await s.get_content_model()
    item = res.first_item
    det = DownloadableFilesDetail(client, resolution=CustomResolutionType.BEST)
    files = await det.get_content_model(item.subject_id, release_date=str(item.release_date))
    mf = files.best_media_file
    print(f"[MOVIE] {item.title} ({item.release_date.year}) subj={item.subject_id}")
    print(f"        resolutions={[f.resolution for f in files.list]}")
    print(f"        BEST {mf.resolution}p size={mf.size} url={str(mf.url)[:80]}...")
    return item, files, mf


async def resolve_episode(client, title, season, episode):
    s = Search(client, query=title, subject_type=SubjectType.TV_SERIES, per_page=10)
    res = await s.get_content_model()
    item = res.first_item
    print(f"[SERIES] {item.title} subj={item.subject_id} seNum={item.season_numbers}")
    seasons_model = await SeasonDetails(client).get_content_model(item.subject_id)
    print(f"         seasons={[(x.se, x.max_ep) for x in seasons_model.seasons]}")
    params = get_download_tv_series_request_params(
        seasons=seasons_model.seasons, episode=episode, season=season, limit=1,
    )
    target = None
    for rp in params.request_params:
        det = DownloadableFilesDetail(client, page=rp.page, per_page=rp.per_page,
                                      resolution=CustomResolutionType.BEST)
        files = await det.get_content_model(item.subject_id, release_date=str(item.release_date))
        window = files.list[rp.offset:][:rp.limit]
        for vf in window:
            if vf.season == season and vf.episode == episode:
                target = (vf, files)
                break
        if target:
            break
    if target:
        vf, files = target
        print(f"         S{vf.season}E{vf.episode} {vf.resolution}p url={str(vf.url)[:80]}...")
        return item, files, vf
    print(f"         !! S{season}E{episode} NOT FOUND")
    return item, None, None


async def resolve_caption(client, subject_id, video_file):
    cap = DownloadableCaptionFileDetails(client)
    model = await cap.get_content_model(subject_id, video_file)
    eng = model.english_subtitle_file
    if eng:
        print(f"[SUB]    en -> {str(eng.url)[:80]}...")
    else:
        langs = [c.lan for c in model.captions]
        print(f"[SUB]    no English; available={langs}")


async def main():
    async with MovieBoxHttpClient() as client:
        item, files, mf = await resolve_movie(client, "Oppenheimer")
        if mf:
            await resolve_caption(client, item.subject_id, mf)
        print()
        item, files, vf = await resolve_episode(client, "Dexter", 6, 7)
        if vf:
            await resolve_caption(client, item.subject_id, vf)


asyncio.run(main())
