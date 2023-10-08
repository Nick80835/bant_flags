from requests import get
from os import listdir, remove
from pathlib import Path
from asyncio import run, gather
from aiohttp import ClientSession

flags_folder = (Path(__file__).parent / "flags").resolve()
remote_flags = get("https://flags.plum.moe/api/flags").text.split("\n")
[remove(i) for i in [(flags_folder / i).resolve() for i in listdir(flags_folder)]]

async def download_flags():
    async with ClientSession() as session:
        async def get_flag(flag_name):
            with open((flags_folder / (flag_name + ".png")).resolve(), 'wb') as fh:
                fh.write(await (await session.get("https://flags.plum.moe/flags/" + flag_name + ".png")).read())

        await gather(
            *[get_flag(flag) for flag in remote_flags]
        )

run(download_flags())
