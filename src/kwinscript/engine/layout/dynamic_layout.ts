// SPDX-FileCopyrightText: 2022 Philippe Daouadi <philippe@ud2.org>
//
// SPDX-License-Identifier: MIT

import { WindowsLayout } from ".";

import { WindowState, EngineWindow } from "../window";

import {
  Action,
  SplitPartHorizontally,
  SplitPartVertically,
} from "../../controller/action";

import { Rect, RectDelta } from "../../util/rect";
import { Config } from "../../config";
import { Controller } from "../../controller";
import { Engine } from "..";
import LayoutUtils from "./layout_utils";

type SplitDirection = "horizontal" | "vertical";

export class DynamicLayoutPart {
  public gap: number;
  public direction: SplitDirection;
  public subParts: Array<DynamicLayoutPart | string>;

  private config: Config;

  constructor(config: Config, direction: SplitDirection = "horizontal") {
    this.config = config;
    this.gap = 0;
    this.direction = direction;
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

  public split(direction: SplitDirection, currentWindow: EngineWindow): number {
    const replacePart = (position: number) => {
      const newPart = new DynamicLayoutPart(this.config, direction);
      newPart.subParts.push(currentWindow.id);
      this.subParts[position] = newPart;
      console.log('done');
    };

    for (let i = 0; i < this.subParts.length; ++i) {
      const subPart = this.subParts[i];
      if (subPart === currentWindow.id) {
        console.log('found current window', i);
        // If this part contains a single window, replace it instead of nesting
        // a new split. This operation will be handled by the caller.
        if (this.subParts.length === 1) return 2;

        console.log('creating new part');
        replacePart(i);
        return 1;
      } else if (subPart instanceof DynamicLayoutPart) {
        const splitResult = subPart.split(direction, currentWindow);
        if (splitResult === 1) {
          console.log('sub part did the split');
          return 1;
        } else if (splitResult === 2) {
          // The subpart can't handle the split itself, replace it completely.
          console.log('replacing child part');
          replacePart(i);
        }
      }
    }

    return 0;
  }

  public prepare(tiles: EngineWindow[], topLevel: boolean = true): void {
    // Make sure that all windows are referenced. Remove the ones that have
    // disappeared, and add the potentially new ones at the end. Note that most
    // window additions should be handled by newWindow().
    console.log('part prepare');
    for (let i = 0; i < this.subParts.length; ++i) {
      console.log('part iteration');
      const subPart = this.subParts[i];
      if (subPart instanceof DynamicLayoutPart) {
        subPart.prepare(tiles, false);
      } else {
        if (tiles.length > 0 && subPart === tiles[0].id) {
          console.log('part matched window id', subPart);
          tiles.shift();
        } else {
          console.log('part did not match, removing', subPart);
          this.subParts.splice(i, 1);
          --i;
        }
      }
    }
    // Remaining windows
    if (topLevel) {
      while (tiles.length > 0) {
        console.log('adding remaining window', tiles[0].id);
        this.subParts.push(tiles[0].id);
        tiles.shift();
      }
    }
    console.log('part prepared');
  }

  public handelNewWindow(
    currentWindow: EngineWindow,
    newWindow: EngineWindow
  ): boolean {
    console.log(`adding new window ${newWindow.id}`);
    // The new window was inserted in the WindowStore just after the current
    // window, so find it so that we can insert it at the same place, and in the
    // same subpart.
    for (let i = 0; i < this.subParts.length; ++i) {
      const subPart = this.subParts[i];
      if (subPart instanceof DynamicLayoutPart) {
        console.log('recursing');
        if (subPart.handelNewWindow(currentWindow, newWindow)) return true;
      } else {
        if (subPart === currentWindow.id) {
          console.log('found the current window, adding the new one after');
          this.subParts.splice(i + 1, 0, newWindow.id);
          return true;
        }
      }
    }
    console.log('where is the current window??');
    return false;
  }

  public apply(area: Rect, tiles: EngineWindow[]): Rect[] {
    console.log('part apply');
    const partAreas = LayoutUtils.splitAreaWeighted(
      area,
      this.subParts.map((_) => 1.0),
      this.gap,
      this.direction === "horizontal"
    );
    const rects: Array<Rect> = [];
    this.subParts.forEach((subPart, i) => {
      if (subPart instanceof DynamicLayoutPart) {
        console.log('applying subpart');
        const subRects = subPart.apply(partAreas[i], tiles);
        rects.splice(rects.length, 0, ...subRects);
      } else {
        if (subPart !== tiles[0].id) {
          // FIXME: how are we supposed to log these kind of recoverable errors?
          console.error(
            `apply: unexpected window id: ${tiles[0].id}, expected: ${subPart}`
          );
        }
        console.log('applying window', subPart);
        rects.push(partAreas[i]);
        tiles.shift();
      }
    });
    console.log('part applied');
    return rects;
  }

  // FIXME: debug stuff, remove
  public dump(depth: number = 0): void {
    this.subParts.forEach((subPart) => {
      if (subPart instanceof DynamicLayoutPart) subPart.dump(depth + 1);
      else console.log("  ".repeat(depth), subPart);
    });
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

  public handelNewWindow(
    currentWindow: EngineWindow,
    newWindow: EngineWindow
  ): void {
    this.parts.handelNewWindow(currentWindow, newWindow);
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
      console.log('layout apply', tileables.map(x => x.id));
      tileables.forEach((tileable) => (tileable.state = WindowState.Tiled));
      console.log('parts');
      this.parts.dump();

      // Applying the layout must be done in two steps. First we prepare to detect
      // all windows we might have missed (like when the layout is first used) and
      // add them to the layout. Then we can apply the layout, once it has been
      // synchronized with the current windows.
      console.log('layout prepare');
      this.parts.prepare(tileables.slice());
      const rects = this.parts.apply(area, tileables.slice());
      console.log('layout result:', rects);
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
    this.parts.dump();
    if (action instanceof SplitPartHorizontally) {
      console.log('split horizontal triggered');
      const currentWindow = engine.currentWindow();
      if (currentWindow) this.parts.split("horizontal", currentWindow);
    } else if (action instanceof SplitPartVertically) {
      console.log('splitting vertically');
      const currentWindow = engine.currentWindow();
      if (currentWindow) this.parts.split("vertical", currentWindow);
    } else {
      action.executeWithoutLayoutOverride();
    }
    this.parts.dump();
  }

  public toString(): string {
    return `DynamicLayout()`;
  }
}
