import { BLOCK0_SPEC } from "./block0.js";
import { BLOCK1_SPEC } from "./block1.js";
import { BLOCK2_SPEC } from "./block2.js";
import { BLOCK3_SPEC } from "./block3.js";
import { BLOCK4_SPEC } from "./block4.js";
import { BLOCK5_SPEC } from "./block5.js";

export const BLOCK_SPECS = [
  BLOCK0_SPEC,
  BLOCK1_SPEC,
  BLOCK2_SPEC,
  BLOCK3_SPEC,
  BLOCK4_SPEC,
  BLOCK5_SPEC,
];

export const BLOCK_SPEC_BY_ID = BLOCK_SPECS.reduce(function toMap(acc, spec) {
  acc[spec.id] = spec;
  return acc;
}, {});
