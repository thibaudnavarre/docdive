"""docdive adapter for MkDocs. Data only: the product logic lives in the `docdive` CLI."""

import json
import re
import shlex
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from mkdocs.config import base
from mkdocs.config import config_options as c
from mkdocs.config.defaults import MkDocsConfig
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin
from mkdocs.structure.files import Files
from mkdocs.structure.pages import Page

from . import __version__

FENCE = re.compile(r'(<pre class="mermaid">.*?</pre>)', re.DOTALL)
ELEMENT_SCRIPT = "docdive/docdive-element.js"


class DocdiveConfig(base.Config):
    # How to run the docdive CLI. Pin it to this plugin's version so the two cannot drift apart.
    command = c.Type(str, default=f"npx --yes docdive@{__version__}")
    # Repo root that `src:` frontmatter paths are relative to (optional).
    src = c.Optional(c.Type(str))


class DocdivePlugin(BasePlugin[DocdiveConfig]):
    def __init__(self) -> None:
        self.doc_urls: dict[str, str] = {}

    def on_config(self, config: MkDocsConfig) -> MkDocsConfig:
        script = c.ExtraScriptValue(ELEMENT_SCRIPT)
        script.type = "module"
        config.extra_javascript.append(script)
        return config

    def on_files(self, files: Files, config: MkDocsConfig) -> Files:
        # src_uri -> site-absolute URL (site_url path + file url), so the element needs no base-URL logic.
        base_path = urlparse(config.site_url or "").path.rstrip("/")
        self.doc_urls = {f.src_uri: f"{base_path}/{f.url}" for f in files.documentation_pages()}
        return files

    def on_page_content(self, html: str, page: Page, config: MkDocsConfig, files: Files) -> str:
        # Wrap the fence before the theme mounts it; the element takes the text out of the light DOM.
        return FENCE.sub(r"<docdive-diagram>\1</docdive-diagram>", html)

    def on_post_build(self, config: MkDocsConfig) -> None:
        dest = Path(config.site_dir) / "docdive"
        command = shlex.split(self.config.command)
        executable = shutil.which(command[0])
        if executable is None:
            raise PluginError(f"docdive: cannot run `{command[0]}`; Node.js >= 22.12 is required at build time")
        args = [executable, *command[1:], "build", str(config.docs_dir), "--out", str(dest)]
        if self.config.src:
            args += ["--src", str(Path(self.config.src).resolve())]
        try:
            subprocess.run(args, check=True)
        except subprocess.CalledProcessError as error:
            raise PluginError(f"docdive: `{' '.join(args)}` exited with {error.returncode}") from error
        (dest / "docdive-map.json").write_text(json.dumps(self.doc_urls, indent=2) + "\n")
