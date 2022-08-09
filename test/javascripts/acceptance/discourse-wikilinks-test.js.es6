import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { visit } from "@ember/test-helpers";

acceptance("Discourse Wikilinks", function (needs) {
  needs.user();

  test("Discourse eikilinks button works", async (assert) => {
    await visit("/admin/plugins/discourse-wikilinks");

    // Ember docs: https://guides.emberjs.com/v2.13.0/testing/acceptance/
    // https://meta.discourse.org/t/beginner-s-guide-to-creating-discourse-plugins-part-6-acceptance-tests/32619#adding-an-acceptance-test-in-your-plugin-1
    //
    // andThen(() => {
    //   assert.ok(
    //     exists("#show-tentacle"),
    //     "it shows the purple tentacle button"
    //   );
    //   assert.ok(!exists(".tentacle"), "the tentacle is not shown yet");
    // });

    // click("#show-tentacle");

    // andThen(() => {
    //   assert.ok(exists(".tentacle"), "the tentacle wants to rule the world!");
    // });
  });
});
