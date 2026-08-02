import fs from "node:fs";
import path from "node:path";

export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("style_light.css");
    eleventyConfig.addPassthroughCopy("assets");

    eleventyConfig.setFrontMatterParsingOptions({ excerpt: true });

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
