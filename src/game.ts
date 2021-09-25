 /*     Explosive Excavation
  *   a game where the player attempts to discover where
  * a set number of explosives are hidden.
  *     Author: Alex Pazder
  * 
  *   Notes:
  *     -logs are viewable through the debugger in your browser
  *       standard shortcut is <ctrl + shift + j>
  *     -any changes to models require a reload of you console
  */

 //additions to allow collections to be managed as dictionaries
 // source: Dominik Marciniszyn, codetain.com
 export interface IKeyCollection<T>
  {
  add(key: string, value: T): undefined;
  containsKey(key: string): boolean;
  size(): number;
  getItem(key: string): T;
  removeItem(key: string): T;
  getKeys(): string[];
  values(): T[];
}
 export default class Dictionary<T> implements IKeyCollection<T> 
 {
  private items: { [index: string]: T } = {};
  private count: number = 0;

  add(key: string, value: T): undefined {
    if (!this.items.hasOwnProperty(key)) {
      this.count++;
    }

    this.items[key] = value;
    return;
  }

  containsKey(key: string): boolean {
    return this.items.hasOwnProperty(key);
  }

  size(): number {
    return this.count;
  }

  getItem(key: string): T {
    return this.items[key];
  }

  removeItem(key: string): T {
    let value = this.items[key];

    delete this.items[key];
    this.count--;

    return value;
  }

  getKeys(): string[] {
    let keySet: string[] = [];

    for (let property in this.items) {
      if (this.items.hasOwnProperty(property)) {
        keySet.push(property);
      }
    }

    return keySet;
  }

  values(): T[] {
    let values: T[] = [];

    for (let property in this.items) {
      if (this.items.hasOwnProperty(property)) {
        values.push(this.items[property]);
      }
    }

    return values;
  }
}

//size and positioning settings
const world_size_x:number = 10;
const world_size_y:number = 10;

const spacing_x:number = 1.5; 
const spacing_y:number = 1.5;

const offset_x:number = 1.25;
const offset_y:number = 1.25;

//used for texts to display number of explosives
//  directly adjacent
const block_text:string[] = 
  ['1', '2', '3',
   '4', '5', '6', 
   '◯', '◯', '◯'];
const block_text_size:number[] = 
  [12, 12, 8, 
    8, 4, 4, 
    4, 4, 4];
const block_text_colour:Color3[] = 
  [Color3.Blue(), Color3.Green(), Color3.Yellow(), 
  Color3.Red(), Color3.Red(), Color3.Red(), 
  Color3.Red(), Color3.Red(), Color3.Red()];

//create material and configure its fields
const flag_button_material = new Material();
flag_button_material.albedoColor = Color3.Black();
flag_button_material.metallic = 0.5;
flag_button_material.roughness = 0.5;

//gameplay options
//  game states: 
//    0 ilde: a game has ended
//    1 starting: game is waiting for players to register
//    2 pre-gen session: game is waiting for player to click first tile before
//  map is generated, prevents player from dying on first move
//    3 post-gen session: map has been generated and game is being played
var game_state:number;

var block_count_total:number;
var block_count_uncovered:number;
var explosive_count_total:number;
var explosive_count_correct:number;
var flag_count:number;

//collection of all exsisting blocks
let world_block_dict = new Dictionary<Block>();
function doesBlockExsists(x:number, y:number)
{
  return world_block_dict.containsKey(getIndex(x,y));
}
function getBlock(x:number, y:number)
{
  return world_block_dict.getItem(getIndex(x,y));
}

//used to standardize indexing of tiles based on pos
function getIndex(x:number, y:number)
{
  return x.toString()+"_"+y.toString();
}

//block used to construct the playing field
@Component("Block")
export class Block 
{
  //identity of this block
  public Index() { return getIndex(this.pos_x, this.pos_y); }

  pos_x:number;
  pos_y:number;

  //whether block is a bomb
  //  0: safe
  //  1: bomb
  type:number;
  public Type() { return this.type; }
  //cannot be edited during session
  public SetType(value:number) { if(game_state != 3) this.type = value; }

  //current state of this block
  //  0:covered
  //  1:uncovered
  //  2:flagged
  state:number;
  public State() { return this.state; }
  //only editable in-session
  public SetState(value:number) { if(game_state == 3) this.state = value; }

  //count of how many bombs surround this block
  count:number;
  public Count() { return this.count; }
  //cannot be edited during session
  public SetCount(value:number) { if(game_state != 3) this.count = value; }

  //block object in world space
  gameObject:Entity;
  public GameObject() { return this.gameObject; }

  //flag object for the block
  flagObject:Entity;
  public SetFlag()
  {
    //ensure the game is in session and player has flags remaining
    if(game_state == 3)
    {
      //currently covered
      if(this.State() == 0 && flag_count < explosive_count_total)
      {
        log("flagging block...");
        this.SetState(2);
        engine.addEntity(this.flagObject);

        //record number of flags
        flag_count++;
        if(this.Type() == 1)
        {
          explosive_count_correct++;
          //check win condition
          if(explosive_count_correct == explosive_count_total)
          {
            changeGameState(4);
          }
        }
      }
      //currently flagged
      else if(this.State() == 2)
      {
        log("unflagging block...");
        this.SetState(0);
        engine.removeEntity(this.flagObject);

        //record number of flags
        flag_count--;
        if(this.Type() == 1)
        {
          explosive_count_correct--;
        }
      }

      ui_text_remaining_bombs.value = "Bombs Remaining: "+ (explosive_count_total - flag_count).toString();
    }
  }

  //text object for the block in world space
  textObject:Entity|undefined;
  //given value is the number of bombs nearby
  public SetText()
  {
    //if game is not in session or there are no nearby bombs
    if(game_state != 3)
    {
      return;
    }

    //if block is covered
    if(this.State() == 0)
    {
      //increase number of blocks uncovered
      block_count_uncovered++;
      //update ui
      ui_text_remaining_blocks.value = "Blocks Remaining: " + (block_count_total - block_count_uncovered).toString();
    }

    //block has been uncovered
    this.SetState(1);

    if(this.Count() != 0)
    {
      //create entity
      this.textObject = new Entity();
      //place object over gameobject in-world
      this.textObject.addComponent(new Transform
      (
        { 
          position: new Vector3
          (
            this.gameObject.getComponent(Transform).position.x,
            this.gameObject.getComponent(Transform).position.y + 0.25,
            this.gameObject.getComponent(Transform).position.z
          )
        }
      ));
      this.textObject.getComponent(Transform).rotate(Axis.X, 90);
      //add and set text
      this.textObject.addComponent(new TextShape(block_text[this.Count()-1]));
      this.textObject.getComponent(TextShape).fontSize = block_text_size[this.Count()-1];
      this.textObject.getComponent(TextShape).color = block_text_colour[this.Count()-1];
      this.textObject.getComponent(TextShape).font = new Font(Fonts.LiberationSans);

      //add the entity to the engine
      engine.addEntity(this.textObject);
    }
  }

  //used to initialize a block
  constructor(x:number, y:number, obj:Entity)
  {
    this.pos_x = x;
    this.pos_y = y;
    this.type = 0;
    this.state = 0;
    this.count = 0;
    this.gameObject = obj;
    
    //prepare flag object
    this.flagObject = new Entity();
    //add a transform to entity, placing it in the game world
    this.flagObject.addComponent(new Transform
    (
      { 
        position: new Vector3
        (
          this.gameObject.getComponent(Transform).position.x,
          this.gameObject.getComponent(Transform).position.y + 0.4,
          this.gameObject.getComponent(Transform).position.z
        )
      }
    ));
    //add a shape to entity, providing visibility in the game world
    this.flagObject.addComponent(new GLTFShape("models/BlockFlag.glb"));
    //assign the material to the entity
    this.flagObject.addComponent(flag_button_material);
  }

  //used to reset a block to its starting state
  public ResetBlock()
  {
    //if game is in session, this cannot be called
    if(game_state == 3) return;

    //if there is a text object
    if(this.textObject != undefined)
    {
      //TODO: if the system cleaning cycles are slow this could end up being
      //  a memory leak, should try and implement a pooling system

      //remove text object
      engine.removeEntity(this.textObject);
      this.textObject = undefined;
    }
    //if there is a flag object
    if(this.State() == 2)
    {
      //TODO: if the system cleaning cycles are slow this could end up being
      //  a memory leak, should try and implement a pooling system

      //remove flag object
      engine.removeEntity(this.flagObject);
    }

    //reset size
    this.gameObject.getComponent(Transform).scale.y = 1.0;
    this.gameObject.getComponent(Transform).position.y = 0.0;

    this.type = 0;
    this.state = 0;
    this.count = 0;
  }
}

//sets the start-point of the game
function generateGameMap(startBlock:Block)
{
  //place explosives
  var explosives_to_place:number = explosive_count_total;
  var ind_x:number, ind_y:number;
  var block:Block;
  while(explosives_to_place > 0)
  {
    //grab a random location
    ind_x = Math.floor(Math.random() * world_size_x);
    ind_y = Math.floor(Math.random() * world_size_y);

    block = getBlock(ind_x,ind_y);

    //if that location is not already a mine and is not the starting position
    if(block.Type() != 1 && block != startBlock)
    {
      getBlock(ind_x,ind_y).SetType(1);
      explosives_to_place--;
    }
  }

  //set the number of neighbouring bombs for each tile
  for (let y = 0; y < world_size_y ; y++) 
  { 
    for (let x = 0; x < world_size_x ; x++) 
    {
      //reset counter
      var count:number = 0;

      //count bombs
      for (let offset_y = -1; offset_y < 2 ; offset_y++) 
      { 
        for (let offset_x = -1; offset_x < 2 ; offset_x++) 
        {
          if(world_block_dict.containsKey(getIndex(x+offset_x,y+offset_y)) == true)
          {
            if(world_block_dict.getItem(getIndex(x+offset_x,y+offset_y)).Type() == 1)
            {
              count++;
            }
          }
        }
      }

      //assign number of bombs
      world_block_dict.getItem(getIndex(x,y)).SetCount(count);
    }
  }

  //change game state
  changeGameState(3);
}

//cycles the game state
function changeGameState(value:number)
{
  //check current game state
  game_state = value;
  log("Game state has changed: " + game_state.toString());
  switch(value)
  {
    //idle
    case 0:
      menu_button_material.albedoColor = Color3.Red();
      //update ui
      ui_text_status.value = "Game Idle";
      ui_text_status.color = Color4.Black();
      ui_text_remaining_blocks.value = "---";
      ui_text_remaining_bombs.value = "---";
      break;
    //lobby mode
    case 1:
      //reset game values
      block_count_uncovered = 0;
      explosive_count_correct = 0;
      flag_count = 0;
      //randomize number of bombs
      block_count_total = world_size_x * world_size_y;
      explosive_count_total = 14 + Math.floor(Math.random() * 6);
      //reset exsisting block objects
      for (let y = 0; y < world_size_y ; y++) 
      { 
        for (let x = 0; x < world_size_x ; x++) 
        {
          getBlock(x,y).ResetBlock();
        }
      }
      //
      menu_button_material.albedoColor = Color3.Yellow();
      //update ui
      ui_text_status.value = "Waiting For Players...";
      ui_text_status.color = Color4.Yellow();
      ui_text_remaining_blocks.value = "Blocks Remaining: " + block_count_total.toString();
      ui_text_remaining_bombs.value = "Bombs Remaining: " + explosive_count_total.toString();
      break;
    //pre-gen
    case 2:
      menu_button_material.albedoColor = Color3.Green();
      //update ui
      ui_text_status.value = "Game Ongoing";
      ui_text_status.color = Color4.Green();
      ui_text_remaining_blocks.value = "Blocks Remaining: " + block_count_total.toString();
      ui_text_remaining_bombs.value = "Bombs Remaining: " + explosive_count_total.toString();
      break;
    //post-gen
    case 3:
      menu_button_material.albedoColor = Color3.Green();
      //update ui
      ui_text_status.value = "Game Ongoing";
      ui_text_status.color = Color4.Green();
      break;
    //game win
    case 4:
      changeGameState(0);
      //update ui
      ui_text_status.value = "Game Won";
      ui_text_status.color = Color4.Purple();
      break;
    //game loss
    case 5:
      changeGameState(0);
      //update ui
      ui_text_status.value = "Game Lost";
      ui_text_status.color = Color4.Red();
      break;
    
  }
}

//attempts to uncover the given block
function uncoverBlock(block:Block)
{
  //if game is waiting for generation
  if(game_state == 2)
  {
    //generate map
    generateGameMap(block);
  }

  //if game is in-session
  if(game_state == 3)
  {
    //if block is covered
    if(block.State() == 0)
    {
      //if this block has a bomb
      if(block.Type() == 1)
      {
        log("target block is a mine: you lost!"); 
        //end game as a loss
        changeGameState(5);
      }
      //block is not a mine
      else
      {
        log("target block has been revealed"); 

        //set block text
        block.SetText();

        //transform block
        block.GameObject().getComponent(Transform).scale.y = 0.5;
        block.GameObject().getComponent(Transform).position.y = 0.0;
      }
    }
    else { log("target block is not covered"); }

    //snowball reveal
    //check all neighbours for empty blocks
    //  NOTE: i don't know the limitations for the system, so we only
    //  check the blocks directly nearby the targeted block instead of
    //  recurssively checking blocks down the chain
    for (let offset_y = -1; offset_y < 2 ; offset_y++) 
    { 
      for (let offset_x = -1; offset_x < 2 ; offset_x++) 
      {
        //skip if this is the current block
        if(offset_x == 0 && offset_y == 0)
        {
          continue;
        }
        //if central or target block has no nearby bombs
        if(block.Count() == 0 || getBlock(block.pos_x+offset_x,block.pos_y+offset_y).Count() == 0)
        {
          //check block's exsistance and nearby bombs
          if(doesBlockExsists(block.pos_x+offset_x,block.pos_y+offset_y)
          && getBlock(block.pos_x+offset_x,block.pos_y+offset_y).State() == 0
          && getBlock(block.pos_x+offset_x,block.pos_y+offset_y).Type() == 0)
          {
            //set block text
            getBlock(block.pos_x+offset_x,block.pos_y+offset_y).SetText();
        
            //transform block
            getBlock(block.pos_x+offset_x,block.pos_y+offset_y).GameObject().getComponent(Transform).scale.y = 0.5;
            getBlock(block.pos_x+offset_x,block.pos_y+offset_y).GameObject().getComponent(Transform).position.y = 0.0;
          }
        }
      }
    }
  }
  else { log("failed to uncover block: game not in session"); }
}

//creates and prepares a single block that will be created at the given location 
function spawnBlock(x: number, y: number) 
{
  //create block's entity
  const block: Entity = new Entity();

  //add a shape to entity, providing visibility in the game world
  block.addComponent(new GLTFShape("models/BlockTile.glb"));

  //add a transform to entity, placing it in the game world
  block.addComponent(new Transform(
    { position: new Vector3
      (
        (x * spacing_x) + offset_x, 
        0, 
        (y * spacing_y) + offset_y
      ) 
    })
  );

  //add object data to entity and register it
  block.addComponent(new Block(x, y, block));
  world_block_dict.add(getIndex(x,y), block.getComponent(Block));

  //add interactions
  //  primary action: uncover tile
  block.addComponent
  (
    //add click action listener
    new OnPointerDown(
      (e) => 
      {
        log("Attempting to uncover block: "+x.toString()+", "+y.toString());
        uncoverBlock(block.getComponent(Block));
      },
      { button: ActionButton.PRIMARY }
    )
  )
  //  secondary action: flag block
  block.addComponent
  (
    //add click action listener
    new OnPointerUp(
      (e) => 
      {
        log("Toggling flag on block: "+x.toString()+", "+y.toString());
        block.getComponent(Block).SetFlag();
      },
      { button: ActionButton.SECONDARY }
    )
  )

  //add the entity to the engine
  engine.addEntity(block);
}

//spawn blocks
for (let y = 0; y < world_size_y ; y++) 
{ 
  for (let x = 0; x < world_size_x ; x++) 
  {
    //spawn block at each location
    const curBlock = spawnBlock(x,y);
  }
}

//spawn reset button
const reset_button:Entity = new Entity();
//add interaction
reset_button.addComponent
(
  //add click action listener
  new OnPointerDown
  (
    (e) => 
    {
      changeGameState(1);
    },
    { button: ActionButton.PRIMARY }
  )
)
//add a transform to entity, placing it in the game world
reset_button.addComponent(new Transform({ position: new Vector3(8, 4, 8) }));
//add a shape to entity, providing visibility in the game world
reset_button.addComponent(new BoxShape());
//create material and configure its fields
const reset_button_material = new Material();
reset_button_material.albedoColor = Color3.Black();
reset_button_material.metallic = 0.5;
reset_button_material.roughness = 0.5;
//assign the material to the entity
reset_button.addComponent(reset_button_material);
//add the entity to the engine
engine.addEntity(reset_button);

//create block's entity
const menu_button:Entity = new Entity();
//add interaction
menu_button.addComponent
(
  //add click action listener
  new OnPointerDown
  (
    (e) => 
    {
      if(game_state == 0) changeGameState(1);
      else if(game_state == 1) changeGameState(2);
    },
    { button: ActionButton.PRIMARY }
  )
)
//add a transform to entity, placing it in the game world
menu_button.addComponent(new Transform({ position: new Vector3(8, 2, 8) }));
//add a shape to entity, providing visibility in the game world
menu_button.addComponent(new BoxShape());
//create material and configure its fields
const menu_button_material = new Material();
menu_button_material.metallic = 0.5;
menu_button_material.roughness = 0.5;
//assign the material to the entity
menu_button.addComponent(menu_button_material);
//add the entity to the engine
engine.addEntity(menu_button);

//TODO: make a few helper functions to cut down on the amount of code here
//  eg. function setText(takes in text, string, and font size)
//ui components and setup
const ui_canvas = new UICanvas();
//rect container
const rect = new UIContainerRect(ui_canvas);
rect.width = 200;
rect.height = 120;
rect.hAlign = "right";
rect.vAlign = "bottom";
rect.color = Color4.Gray();
rect.opacity = 0.8;
//texts -- title
const ui_text_title = new UIText(rect);
ui_text_title.value = "Minesweeper";
ui_text_title.fontSize = 20;
ui_text_title.width = "50%";
ui_text_title.height = 20;
ui_text_title.positionY = -5;
ui_text_title.hAlign = "center";
ui_text_title.vAlign = "top";
//texts -- game status
const ui_text_status = new UIText(rect);
ui_text_status.value = "Game Status: ";
ui_text_status.fontSize = 15;
ui_text_status.width = "85%";
ui_text_status.height = 20;
ui_text_status.positionY = -20;
ui_text_status.hAlign = "center";
ui_text_status.vAlign = "top";
//texts -- blocks remaining
const ui_text_remaining_blocks = new UIText(rect);
ui_text_remaining_blocks.value = "Blocks: ###";
ui_text_remaining_blocks.fontSize = 15;
ui_text_remaining_blocks.width = "90%";
ui_text_remaining_blocks.height = 20;
ui_text_remaining_blocks.positionY = -40;
ui_text_remaining_blocks.hAlign = "center";
ui_text_remaining_blocks.vAlign = "top";
//texts -- bombs remaining
const ui_text_remaining_bombs = new UIText(rect);
ui_text_remaining_bombs.value = "Bombs: ###";
ui_text_remaining_bombs.fontSize = 15;
ui_text_remaining_bombs.width = "90%";
ui_text_remaining_bombs.height = 20;
ui_text_remaining_bombs.positionY = -60;
ui_text_remaining_bombs.hAlign = "center";
ui_text_remaining_bombs.vAlign = "top";
//texts -- shameless self promotion ^_^
const ui_text_promo_label = new UIText(rect);
ui_text_promo_label.value = "TheCryptoTrader69@gmail.com";
ui_text_promo_label.fontSize = 10;
ui_text_promo_label.width = "75%";
ui_text_promo_label.height = 20;
ui_text_promo_label.positionY = 0;
ui_text_promo_label.hAlign = "center";
ui_text_promo_label.vAlign = "bottom";

//set the default game state
changeGameState(0);