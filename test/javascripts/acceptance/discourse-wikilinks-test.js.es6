import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { visit } from "@ember/test-helpers";

acceptance("Discourse Wikilinks", function (needs) {
  needs.user();

  test("Discourse wikilinks button works", async () => {
    await visit(
      "/admin/site_settings/category/plugins?filter=plugin%3Adiscourse-wikilinks"
    );

    andThen(() => {
      assert.ok(
        exists('input[type="text"]'),
        "it shows the new wikilink template setting"
      );
    });
  });
});
