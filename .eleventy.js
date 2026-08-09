import fs from "node:fs";
import path from "node:path";

export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("style_light.css");
    eleventyConfig.addPassthroughCopy("assets");

    // The default excerpt separator is "---", which Eleventy strips out of the
    // body. That eats markdown table delimiter rows and horizontal rules, so
    // use a marker that can't collide with real content.
    eleventyConfig.setFrontMatterParsingOptions({
        excerpt: true,
        excerpt_separator: "<!-- excerpt -->"
    });

    // "romanetsk" from ./locations/romanetsk.md or ./locations/romanetsk/npcs/x.md
    function locationFromInputPath(inputPath) {
        const match = /(?:^|[\/\\])locations[\/\\]([^\/\\]+)/.exec(inputPath || "");
        return match ? match[1].replace(/\.[^.]+$/, "") : null;
    }

    // "mustafar_khanakin" -> "Mustafar Khanakin", the label when no title is found
    function prettifySlug(slug) {
        return slug
            .split(/[_-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    // Collections aren't reachable from shortcodes, so read the title off disk.
    // Returns null if the entry file doesn't exist.
    function titleOf(location, folder, slug) {
        const file = path.join("locations", location, folder, `${slug}.md`);
        if (!fs.existsSync(file)) {
            return null;
        }
        const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, "utf8"));
        const title = frontMatter && /^title:\s*(.+)$/m.exec(frontMatter[1]);
        return title ? title[1].trim().replace(/^["']|["']$/g, "") : null;
    }

    // {% npc "mustafar_khanakin" %}                    same location as the current file
    // {% npc "karsk/someone_else" %}                   another location
    // {% npc "mustafar_khanakin", "the old Watcher" %} custom link text
    function entryShortcode(type, folder) {
        return function(reference, label) {
            const [explicitLocation, slug] = reference.includes("/")
                ? reference.split("/")
                : [null, reference];
            const location = explicitLocation || locationFromInputPath(this.page.inputPath);

            if (!location) {
                throw new Error(
                    `{% ${type} "${reference}" %} in ${this.page.inputPath} has no location to ` +
                    `link to. Outside of locations/, write it as "<location>/${slug}".`
                );
            }

            const title = titleOf(location, folder, slug);
            if (title === null) {
                console.warn(
                    `[shortcode] {% ${type} "${reference}" %} in ${this.page.inputPath} points at ` +
                    `locations/${location}/${folder}/${slug}.md, which doesn't exist.`
                );
            }

            const url = eleventyConfig.getFilter("url")(`/locations/${location}/`);
            return `<a href="${url}#${type}-${slug}">${label || title || prettifySlug(slug)}</a>`;
        };
    }

    // "Mixing Potions; Potion Miscibility" -> "mixing-potions-potion-miscibility"
    function headingSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");
    }

    // Two headings with the same words get -2, -3, and so on.
    function uniqueSlug(slug, seen) {
        const count = seen.get(slug) || 0;
        seen.set(slug, count + 1);
        return count ? `${slug}-${count + 1}` : slug;
    }

    // Give every markdown heading an id so a table of contents can link to it.
    eleventyConfig.amendLibrary("md", md => {
        md.core.ruler.push("heading_ids", state => {
            const seen = new Map();
            state.tokens.forEach((token, index) => {
                if (token.type === "heading_open") {
                    token.attrSet("id", uniqueSlug(headingSlug(state.tokens[index + 1].content), seen));
                }
            });
        });
    });

    // {% toc %} builds a contents list from the page's own # and ## headings.
    eleventyConfig.addShortcode("toc", function() {
        const body = fs.readFileSync(this.page.inputPath, "utf8")
            .replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
        const seen = new Map();
        const items = [];
        let inFence = false;

        for (const line of body.split(/\r?\n/)) {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence;
                continue;
            }
            // Every level is slugged, so the numbering of repeated headings stays
            // in step with the markdown-it rule, but only 1 and 2 get listed.
            const heading = inFence ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
            if (heading && !line.includes("Table of Contents")) {
                const text = heading[2].replace(/[*_`]/g, "");
                const id = uniqueSlug(headingSlug(text), seen);
                if (heading[1].length <= 2) {
                    items.push(`<li class="toc-${heading[1].length}"><a href="#${id}">${text}</a></li>`);
                }
            }
        }

        // One line, so markdown-it leaves it alone when included from a .md file.
        return items.length ? `<nav class="toc"><ul>${items.join("")}</ul></nav>` : "";
    });

    eleventyConfig.addShortcode("npc", entryShortcode("npc", "npcs"));
    eleventyConfig.addShortcode("place", entryShortcode("place", "places"));
    eleventyConfig.addShortcode("event", entryShortcode("event", "events"));

    return {
        // The site lives at nmarchuk.github.io/romanetsk/, so every URL built
        // by the `url` filter needs that prefix. Change to "/" if this ever
        // moves to a custom domain.
        pathPrefix: "/romanetsk/"
    };
}
