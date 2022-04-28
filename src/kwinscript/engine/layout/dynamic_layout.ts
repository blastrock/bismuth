// SPDX-FileCopyrightText: 2022 Philippe Daouadi <philippe@ud2.org>
//
// SPDX-License-Identifier: MIT

import { WindowsLayout } from ".";

import { WindowState, EngineWindow } from "../window";

import {
  Action,
} from "../../controller/action";

import { Rect, RectDelta } from "../../util/rect";
import { Config } from "../../config";
import { Controller } from "../../controller";
import { Engine } from "..";
import LayoutUtils from "./layout_utils";

export class DynamicLayoutPart {
  public gap: number;
  public horizontal: boolean;
  public subParts: Array<DynamicLayoutPart | string>;

  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.gap = 0;
    this.horizontal = true;
    this.subParts = [];
  }

  // public adjust(
  //   area: Rect,
  //   tiles: EngineWindow[],
  //   basis: EngineWindow,
  //   delta: RectDelta
  // ): RectDelta {
  //   const weights = LayoutUtils.adjustAreaWeights(
  //     area,
  //     tiles.map((tile) => tile.weight),
  //     this.config.tileLayoutGap,
  //     tiles.indexOf(basis),
  //     delta,
  //     false
  //   );

  //   weights.forEach((weight, i) => {
  //     tiles[i].weight = weight * tiles.length;
  //   });

  //   const idx = tiles.indexOf(basis);
  //   return new RectDelta(
  //     delta.east,
  //     delta.west,
  //     idx === tiles.length - 1 ? delta.south : 0,
  //     idx === 0 ? delta.north : 0
  //   );
  // }

  public prepare(tiles: EngineWindow[]): void {
    console.log('part prepare');
    for (let i = 0; i < this.subParts.length; ++i) {
      console.log('part iteration');
      const subPart = this.subParts[i];
      if (subPart instanceof DynamicLayoutPart) {
        subPart.prepare(tiles);
      } else {
        if (tiles.length > 0 && subPart === tiles[0].id) {
          console.log('part matched window id', subPart);
          const windowActive = tiles[0].window.active;
          tiles.shift();
          // Add new windows that have appeared after the current window
          if (windowActive && this.subParts.length > i + 1) {
            while (tiles.length > 0 && this.subParts[i + 1] !== tiles[0].id) {
              console.log('adding new part for windows after current');
              this.subParts.push(tiles[0].id);
              ++i;
              tiles.shift();
            }
          }
        } else {
          console.log('part did not match, removing', subPart);
          this.subParts.splice(i, 1);
          --i;
        }
      }
    }
    // Remaining windows
    tiles.forEach((tile) => {
      console.log('adding remaining window', tile.id);
      this.subParts.push(tile.id);
    });
    console.log('part prepared');
  }

  public apply(area: Rect, tiles: EngineWindow[]): Rect[] {
    console.log('part apply');
    const partAreas = LayoutUtils.splitAreaWeighted(area, this.subParts.map(_ => 1.0), this.gap, this.horizontal);
    const rects: Array<Rect> = [];
    this.subParts.forEach((subPart, i) => {
      if (subPart instanceof DynamicLayoutPart) {
        console.log('applying subpart');
        const subRects = subPart.apply(partAreas[i], tiles);
        rects.splice(rects.length, 0, ...subRects);
      } else {
        if (subPart !== tiles[0].id) {
          console.error(`apply: unexpected window id: ${tiles[0].id}, expected: ${subPart}`);
        }
        console.log('applying window', subPart);
        rects.push(partAreas[i]);
        tiles.shift();
      }
    });
    console.log('part applied');
    return rects;
  }

  // public hasWindow(window: EngineWindow): boolean {
  //   for (const subPart of this.subParts) {
  //     if (typeof subPart === 'string') {
  //       if (subPart === window.id)
  //         return true;
  //     }
  //     else {
  //       return subPart.hasWindow(window);
  //     }
  //   }
  //   return false;
  // }
}

export default class DynamicLayout implements WindowsLayout {
  public static readonly MIN_MASTER_RATIO = 0.2;
  public static readonly MAX_MASTER_RATIO = 0.8;
  public static readonly id = "DynamicLayout";
  public readonly classID = DynamicLayout.id;
  public readonly name = "Dynamic Layout";
  public readonly icon = "bismuth-dynamic";

  private parts: DynamicLayoutPart;

  private config: Config;

  constructor(config: Config) {
    this.config = config;

    console.log('new part');
    this.parts = new DynamicLayoutPart(this.config);

    this.parts.gap = this.config.tileLayoutGap;
    console.log('constructed');
  }

  // public adjust(
  //   area: Rect,
  //   tiles: EngineWindow[],
  //   basis: EngineWindow,
  //   delta: RectDelta
  // ): void {
  //   this.parts.adjust(area, tiles, basis, delta);
  // }

  public apply(
    _controller: Controller,
    tileables: EngineWindow[],
    area: Rect
  ): void {
    try {
      console.log('layout apply');
      tileables.forEach((tileable) => (tileable.state = WindowState.Tiled));

      console.log('layout prepare');
      this.parts.prepare(tileables.slice());
      console.log('layout parts apply');
      const rects = this.parts.apply(area, tileables.slice());
      console.log('layout result:', rects);
      console.log('layout set geometry');
      rects.forEach((geometry, i) => {
        tileables[i].geometry = geometry;
      });
      console.log('layout applied');
    } catch (e) {
      console.log(e, (e as Error).stack);
      throw e;
    }
  }

  // public clone(): WindowsLayout {
  //   const other = new DynamicLayout(this.config);
  //   other.masterRatio = this.masterRatio;
  //   other.numMaster = this.numMaster;
  //   return other;
  // }

  public executeAction(engine: Engine, action: Action): void {
    action.executeWithoutLayoutOverride();
  }

  public toString(): string {
    return `DynamicLayout()`;
  }
}
