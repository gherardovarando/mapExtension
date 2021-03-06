// Copyright (c) 2016 Gherardo Varando
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

'use strict';

const url = require('url')
const {
  app,
  dialog
} = require('electron').remote
const path = require('path')
const os = require('os')
const fs = require('fs')
const {
  util,
  Modal,
  ButtonsContainer,
  input,
  ToggleElement,
  Sidebar
} = require('electrongui')

const {
  Menu,
  MenuItem,
} = require('electron').remote


function loadMap(filename, next) {
  if (filename === undefined) return
  fs.readFile(filename, 'utf-8', (err, data) => {
    if (err) {
      dialog.showErrorBox("Error", err.message)
      return
    }
    let configuration = JSON.parse(data)
    configuration.type = configuration.type || 'undefined'
    let id = 2
    if (!configuration.type.includes('map')) {
      id = dialog.showMessageBox({
        title: 'Type "map" not specified in configuration file',
        type: 'warning',
        buttons: ['Cancel', 'Add anyway'],
        message: `The type specified in the configuration is: ${configuration.type}`,
        detail: `trying to add this map could result in an error`,
        noLink: true
      })
    }
    if (id === 1) {
      configuration.type = 'map'
    }
    if (id >= 1) {
      configuration.basePath = basePath(configuration, filename)
      configuration = parseMap(configuration)
      configuration.new = true
      configuration = Object.assign(baseConfiguration(), configuration)
      if (typeof next === 'function') {
        next(configuration)
      }
    }
  })
}

function loadMapfromUrl() {
  let modal = new Modal()
  modal.show()
}

function loadMapfromFile(cl) {
  dialog.showOpenDialog({
    title: "Select a configuration file",
    properties: ['openFile'],
    filters: [{
      name: 'Configuration file',
      extensions: ['map.json','mapconfig', 'json', 'config']
    }]
  }, (filename) => {
    if (filename) {
      loadMap(filename[0], cl)
    }
  })
}

function baseConfiguration() {
  return {
    type: 'map',
    name: 'new map',
    authors: os.userInfo().username,
    date: (new Date()).toDateString(),
    layers: {},
    basePath: ''
  }
}

function basePath(configuration, filename) {
  if (configuration) {
    if (configuration.basePath) {
      let ch = dialog.showMessageBox({
        type: "question",
        buttons: ['yes', 'no'],
        title: 'Base path',
        message: 'redefine the basePath ? ',
        detail: `current basePath: ${configuration.basePath}, if redefined it will point to local directory ${filename.substr(0, filename.lastIndexOf(path.sep) + 1)}`
      })
      if (ch === 1) {
        return configuration.basePath
      } else {
        return filename.substr(0, filename.lastIndexOf(path.sep) + 1)
      }
    } else {
      if (filename) {
        return filename.substr(0, filename.lastIndexOf(path.sep) + 1)
      } else {
        return ""
      }
    }
  } else {
    if (filename) {
      return filename.substr(0, filename.lastIndexOf(path.sep) + 1)
    } else {
      return ""
    }
  }
}

function findConfigurationSync(dir, name) {
  let options = []
  let files = fs.readdirSync(dir)
  if (files) {
    for (var f in files) {
      if (files[f].endsWith(".layerconfig")) {
        if (files[f].includes(name)) return util.readJSONsync(dir + files[f])
        options.push(files[f])
      }
      if (files[f].endsWith(".json")) {
        if (files[f].includes(name)) return util.readJSONsync(dir + files[f])
        options.push(files[f])
      }
      if (files[f].endsWith(".config")) {
        if (files[f].includes(name)) return util.readJSONsync(dir + files[f])
        options.push(files[f])
      }
    }
  }
  if (options.length >= 1) {
    return util.readJSONsync(dir + options[0])
  } else {
    return {}
  }
}


function parseMap(configuration) {
  let indx = 0
  if (configuration.basePath) {
    if (configuration.basePath.startsWith('http')) {
      configuration.source = 'remote'
    }
    if (configuration.basePath.startsWith('/home')) {
      configuration.source = 'local'
    }
    if (configuration.basePath.startsWith('file://')) {
      configuration.source = 'local'
    }
    if (configuration.basePath.startsWith('C:')) {
      configuration.source = 'local'
    }
  }
  configuration.source = configuration.source || 'local'
  let layers = configuration.layers
  let tiles = configuration.tilesLayers
  let tile = configuration.tielLayers
  let points = configuration.pointsLayers
  let pixels = configuration.pixelsLayers
  let guide = configuration.guideLayers
  let grid = configuration.gridLayers
  let polygons = configuration.polygons
  let regions = configuration.regions
  let alls = {
    layers,
    tiles,
    tile,
    points,
    pixels,
    guide,
    grid,
    polygons,
    regions
  }

  configuration.layers = {}
  for (var a in alls) {
    for (var lay in alls[a]) {
      if (typeof alls[a][lay] === 'string' || alls[a][lay] instanceof String) {
        // if lay is just a string we look at the corresponding folder to find the config file
        try {
          let d = path.join(configuration.basePath, alls[a][lay])
          let c = findConfigurationSync(d, alls[a][lay])
          if (typeof c.type === 'string') {
            c.name = c.name || `${c.type}_${indx++}`
            configuration.layers[lay] = parseLayer(c, d)
          }
        } catch (e) {
          throw e
        }
      } else {
        // otherwise we assume lay is a configuration object
        let c = alls[a][lay]
        c.name = c.name || `${c.type}_${indx++}`
        configuration.layers[lay] = parseLayer(c)
      }
    }
  }
  //now the layers configurations are stored in configuration.layers so we delete all the rest
  delete configuration.tilesLayers
  delete configuration.tileLayers
  delete configuration.pointsLayers
  delete configuration.pixelsLayers
  delete configuration.author
  delete configuration.guideLayers
  delete configuration.gridLayers
  delete configuration.polygons
  delete configuration.regions

  //return the clean configuration
  return configuration
}

function isAbsolute(x) {
  return (x.startsWith('http:') || x.startsWith('file:') || path.isAbsolute(x))
}

function parseLayer(config, basePath) {
  basePath = basePath || ''
  let url = config.url || config.urlTemplate || config.tilesUrlTemplate || config.tileUrlTemplate || config.pointsUrlTemplate || config.imageUrl
  delete config.urlTemplate
  delete config.tilesUrlTemplate
  delete config.tileUrlTemplate
  delete config.pointsUrlTemplate
  delete config.imageUrl
  if (url) {
    if (isAbsolute(url)) {
      config.url = url
    } else if (url.startsWith(basePath)) {
      config.url = url
    } else {
      config.url = path.join(basePath, url)
    }
  }
  if (config.type == 'tilesLayer' || config.type == 'tileLayer') {
    config.type = 'tileLayer'
  }
  if (config.type.includes('pointsLayer')) {}
  if (config.type.includes('csvTiles')) {}
  if (config.type.includes('pixelsLayer')) {

  }
  if (config.type.includes('guideLayer')) {

  }
  if (config.type.includes('gridLayer')) {

  }
  if (config.type.includes('imageLayer')) {

  }
  if (config.type.includes('drawnPolygons')) {
    config.type = 'featureGroup'
    if (config.polygons) {
      config.layers = config.polygons
    } else {
      config.layers = {}
    }
  }
  if (config.type.includes('polygons')) {
    config.type = 'featureGroup'
    if (config.polygons) {
      config.layers = config.polygons
    } else {
      config.layers = {}
    }
    delete config.polygons
    Object.keys(config.layers).map((key) => {
      config.layers[key].type = config.layers[key].type || 'polygon'
    })
  }
  if (config.type.includes('drawnMarkers')) {
    config.type = 'featureGroup'
    config.layers = config.markers
    delete config.markers
    Object.keys(config.layers).map((key) => {
      config.layers[key].type = config.layers[key].type || 'marker'
    })
  }
  delete config.basePath //because we joined all in the path
  return config
}



function saveAs(configuration, cl, errcl) {
  dialog.showSaveDialog({
    title: `Save ${configuration.name} map`,
    filters: [{
      name: 'JSON',
      extensions: ['map.json','json']
    }, {
      name: 'mapconfig',
      extensions: ['mapconfig']
    }]
  }, (fileName) => {
    if (fileName === undefined) {
      if (typeof 'errcl' === 'function') {
        errcl(configuration)
      }
      return
    }
    exportConfiguration(configuration, fileName, cl, errcl)
  })
}




function exportConfiguration(configuration, dir, cl, errcl) {
  try {
    if (typeof dir === 'string') {
      let basePath = dir.replace(path.basename(dir), "")
      let conf = JSON.parse(JSON.stringify(configuration)) //clone configuration object
      Object.keys(conf.layers).map((key) => {
        let l = conf.layers[key]
        switch (l.type) { //remove the base path from the url of the layers
          case "tilesLayer":
            l.url = l.url.replace(basePath, "")
            break
          case "pointsLayer":
            l.url = l.url.replace(basePath, "")
            break
          case "pixelsLayer":
            l.url = l.url.replace(basePath, "")
            break
          case "imageLayer":
            l.url = l.url.replace(basePath, "")
            break
          default:
        }
        delete l.basePath //delete the base path from layer configuration if present (should not be)
        delete l.previewImageUrl //delete the previewImageUrl it will be created again from the tiles url
        return l
      })
      if (conf.source === 'local') {
        delete conf.basePath //delete the base path from the map configuration (in this way it will be created again when the map will be loaded)
      }
      let content = JSON.stringify(conf)
      fs.writeFile(dir, content, (error) => {
        if (error) {
          if (typeof cl === 'function') {
            errcl(configuration, dir, error)
          }
          return
        }
        if (typeof cl === 'function') {
          cl(configuration, dir)
        }
      })
    }
  } catch (e) {}
}

/**
 * Shows a modal to add a new csvTile layer
 */
function modalcsvlayer(cl, config) {
  config = config || {
    options: {
      columns: {
        x: 0,
        y: 1
      }
    }
  }
  let body = util.div('pane-group pane')
  let sidebar = new Sidebar(body, {
    className: 'pane-mini'
  })
  let paneMain = new ToggleElement(util.div('pane padded'), body)
  let paneSize = new ToggleElement(util.div('pane padded'), body)
  let paneCsv = new ToggleElement(util.div('pane padded'), body)
  let paneStyle = new ToggleElement(util.div('pane padded'), body)
  let hideA = () => {
    paneMain.hide()
    paneCsv.hide()
    paneStyle.hide()
    paneSize.hide()
  }
  paneSize.hide()
  paneCsv.hide()
  paneStyle.hide()

  sidebar.addList()
  sidebar.addItem({
    id: 'main',
    title: '',
    active: true,
    icon: 'fa fa-cog',
    toggle: true,
    onclick: {
      deactive: () => {
        sidebar.list.activeItem('main')
      },
      active: () => {
        hideA()
        sidebar.list.deactiveAll()
        paneMain.show()
      }
    }
  })
  sidebar.addItem({
    id: 'size',
    title: '',
    icon: 'fa fa-arrows',
    toggle: true,
    onclick: {
      deactive: () => {
        sidebar.list.activeItem('size')
      },
      active: () => {
        hideA()
        sidebar.list.deactiveAll()
        paneSize.show()
      }
    }
  })
  sidebar.addItem({
    id: 'csv',
    title: '',
    icon: 'fa fa-file-text-o',
    toggle: true,
    onclick: {
      deactive: () => {
        sidebar.list.activeItem('csv')
      },
      active: () => {
        hideA()
        sidebar.list.deactiveAll()
        paneCsv.show()
      }
    }
  })
  sidebar.addItem({
    id: 'style',
    title: '',
    icon: 'fa fa-adjust',
    toggle: true,
    onclick: {
      deactive: () => {
        sidebar.list.activeItem('style')
      },
      active: () => {
        hideA()
        sidebar.list.deactiveAll()
        paneStyle.show()
      }
    }
  })
  let name = input.input({
    id: 'namenewlayer',
    type: 'text',
    label: 'Name',
    className: 'cell form-control',
    placeholder: 'name',
    parent: paneMain,
    value: config.name || ''
  })
  let url = input.input({
    id: 'urlnewlayer',
    type: 'text',
    label: 'Url template',
    className: 'cell form-control',
    placeholder: '.../{x}/{y}.csv (right click to chose file)',
    parent: paneMain,
    value: config.url || '',
    oncontextmenu: (inp, e) => {
      let menu = Menu.buildFromTemplate([{
        label: 'Local file/directory',
        click: () => {
          dialog.showOpenDialog({
            properties: [
              'openFile',
              'openDirectories'
            ]
          }, (filepaths) => {
            inp.value = filepaths[0]
          })
        }
      }])
      menu.popup({})
    }
  })

  let tileSize = input.input({
    id: 'tilesizenewlayer',
    type: 'text',
    label: 'tile size',
    className: 'cell form-control',
    placeholder: 'tile size',
    parent: paneSize,
    value: config.options.tileSize || ''
  })
  let size = input.input({
    id: 'sizenewlayer',
    type: 'text',
    label: 'Size',
    className: 'cell form-control',
    placeholder: 'size',
    parent: paneSize,
    value: config.options.size || ''
  })
  let bounds = input.input({
    id: 'boundsnewlayer',
    type: 'text',
    label: 'Bounds',
    className: 'cell form-control',
    placeholder: 'bounds [[lat,lng],[lat,lng]]',
    parent: paneSize,
    value: config.options.bounds || ''
  })
  let minz = input.input({
    id: 'minzoomnewlayer',
    type: 'number',
    label: 'min Zoom',
    className: 'cell form-control',
    placeholder: 'minZoom',
    parent: paneStyle,
    value: config.options.minZoom || 0
  })
  let maxz = input.input({
    id: 'maxzoomnewlayer',
    type: 'number',
    label: 'max Zoom',
    className: 'cell form-control',
    placeholder: 'maxZoom',
    parent: paneStyle,
    value: config.options.maxZoom || 10
  })
  let colx = input.input({
    type: 'number',
    label: 'x:',
    className: 'form-control',
    placeholder: 'x',
    min: 0,
    parent: paneCsv,
    value: config.options.columns.x
  })

  let coly = input.input({
    id: 'maxzoomnewlayer',
    type: 'number',
    label: 'y:',
    className: 'form-control',
    placeholder: 'y',
    min: 0,
    parent: paneCsv,
    value: config.options.columns.y
  })
  let colz = input.input({
    id: 'maxzoomnewlayer',
    type: 'number',
    label: 'z:',
    className: 'form-control',
    placeholder: 'undefined',
    parent: paneCsv,
    value: config.options.columns.z
  })

  let localRS = true
  input.checkButton({
    id: 'localRSnewlayer',
    parent: paneSize,
    text: 'localRS',
    className: 'cell',
    active: config.options.localRS,
    ondeactivate: (btn) => {
      localRS = false
    },
    onactivate: (btn) => {
      localRS = true
    }
  })

  let grid = true
  input.checkButton({
    id: 'gridnewlayer',
    parent: paneStyle,
    text: 'grid',
    className: 'cell',
    active: config.options.grid,
    ondeactivate: (btn) => {
      grid = false
    },
    onactivate: (btn) => {
      grid = true
    }
  })

  let modal = new Modal({
    title: 'Add a csvTiles',
    body: body,
    width: '400px',
    onsubmit: () => {
      cl({
        name: name.value,
        type: 'csvTiles',
        url: url.value,
        options: {
          tileSize: JSON.parse(tileSize.value || 256) || 256,
          size: JSON.parse(size.value || 256) || 256,
          bounds: JSON.parse(size.bounds || "[[-256,0],[0,256]]"),
          minZoom: minz.value,
          maxZoom: maxz.value,
          localRS: localRS,
          grid: grid,
          columns: {
            x: colx.value,
            y: coly.value,
            z: colz.value
          }
        }
      })
    }
  })
  modal.show()
}


/**
 * Shows a modal to add a new TileLayer
 */
function modaltilelayer(cl, config) {
  config = config || {
    options: {}
  }
  let body = util.div('cell-container')
  let attribution = null
  let name = input.input({
    id: 'namenewlayer',
    type: 'text',
    label: 'name',
    className: 'cell form-control',
    placeholder: 'name',
    parent: body,
    value: config.name || ''
  })
  let url = input.input({
    id: 'urlnewlayer',
    type: 'text',
    label: 'Url template',
    className: 'cell form-control',
    placeholder: 'url template (right click for options)',
    parent: body,
    value: config.url || '',
    oninput: (inp) => {
      if (inp.value.includes('{level}')) {
        lC.show()
      } else {
        lC.hide()
      }
    },
    oncontextmenu: (inp, e) => {
      let menu = Menu.buildFromTemplate([{
        label: 'Local file/directory',
        click: () => {
          dialog.showOpenDialog({
            properties: [
              'openFile',
              'openDirectories'
            ]
          }, (filepaths) => {
            inp.value = filepaths[0]
          })
        }
      }, {
        label: 'Base layers',
        submenu: [{
          label: 'Wikimedia Maps',
          click: () => {
            inp.value = 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png'
            tileSize.value = 256
            name.value = name.value || 'Wikimedia Maps',
              attribution = 'Wikimedia maps | &copy<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        }, {
          label: 'OpenStreetMap Standard',
          click: () => {
            inp.value = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            tileSize.value = 256
            name.value = name.value || 'OpenStreetMap Standard'
            attribution = '&copy<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
        }]
      }, {
        label: 'Overlay',
        submenu: [{
          label: 'OpenSkyMap',
          click: () => {
            inp.value = 'http://tiles.skimap.org/openskimap/{z}/{x}/{y}.png'
            tileSize.value = 256
            name.value = name.value || ' OpenSkyMap'
            b.classList.remove('active')
            b.innerHTML = 'overlay'
            base = false
          }
        }]
      }])
      menu.popup({})
    },
    value: ''
  })
  let tileSize = input.input({
    id: 'tilesizenewlayer',
    type: 'text',
    label: 'tile size',
    className: 'cell form-control',
    placeholder: 'tileSize',
    parent: body,
    value: config.options.tileSize || ''
  })
  let minz = input.input({
    id: 'minzoomnewlayer',
    type: 'number',
    label: 'min zoom',
    className: 'cell form-control',
    placeholder: 'minZoom',
    parent: body,
    value: config.options.minZoom || 0
  })
  let maxz = input.input({
    id: 'maxzoomnewlayer',
    type: 'number',
    label: 'max zoom',
    className: 'cell form-control',
    placeholder: 'maxZoom',
    parent: body,
    value: config.options.maxZoom || 10
  })
  let base = true
  let b = input.checkButton({
    id: 'basenewlayer',
    parent: body,
    text: 'base layer',
    className: 'cell form-control',
    active: config.baseLayer,
    ondeactivate: (btn) => {
      base = false
      btn.innerHTML = 'overlay'
    },
    onactivate: (btn) => {
      base = true
      btn.innerHTML = 'base layer'
    }
  })
  let lC = new ToggleElement(util.div('cell-container'))
  let minl = input.input({
    id: 'minlevelnewlayer',
    type: 'number',
    label: 'min level',
    className: 'cell form-control',
    placeholder: 'minLevel',
    parent: lC,
    value: config.options.minLevel || 0
  })
  let maxl = input.input({
    id: 'maxzoomnewlayer',
    type: 'number',
    label: 'max level',
    className: 'cell form-control',
    placeholder: 'maxLevel',
    parent: lC,
    value: config.options.maxLevel || 0
  })
  lC.hide().appendTo(body)
  let modal = new Modal({
    title: 'Add a tileLayer',
    body: body,
    width: '400px',
    onsubmit: () => {
      cl({
        name: name.value,
        type: 'tileLayer',
        url: url.value,
        baseLayer: base,
        multiLevel: url.value.includes('{level}'),
        options: {
          tileSize: JSON.parse(tileSize.value || 256) || 256,
          minNativeZoom: minz.value,
          maxNativeZoom: maxz.value,
          minZoom: minz.value,
          maxZoom: maxz.value,
          minLevel: minl.value,
          maxLevel: maxl.value,
          attribution: attribution
        }
      })
    }
  })
  modal.show()
}

/**
 * Show a modal to add a new guide layer
 */
function modalGuideLayer(cl) {
  let body = util.div('cell-container')
  let name = input.input({
    id: 'namenewlayer',
    type: 'text',
    label: '',
    className: 'cell form-control',
    placeholder: 'name',
    parent: body,
    value: ''
  })
  let size = input.input({
    id: 'sizenewlayer',
    type: 'number',
    label: '',
    className: 'cell form-control',
    placeholder: 'size',
    parent: body,
    value: ''
  })
  let tilesize = input.input({
    id: 'tilesizenewlayer',
    type: 'number',
    label: '',
    className: 'cell form-control',
    placeholder: 'tilesize',
    parent: body,
    value: ''
  })

  let modal = new Modal({
    title: 'Add a tileLayer',
    body: body,
    width: '400px',
    onsubmit: () => {
      cl({
        name: name.value || 'guide',
        type: 'guideLayer',
        size: JSON.parse(size.value) || 256,
        tileSize: JSON.parse(tilesize.value) || 256
      })
    }
  })
  modal.show()
}



/**
 * Create new empty map, it shows a modal to select the name
 */
function createMap(cl) {
  let body = util.div()
  let name = input.input({
    id: 'newmapname-modal',
    parent: body,
    value: '',
    autofocus: true,
    label: '',
    className: 'form-control',
    width: '100%',
    placeholder: 'new map name',
    title: 'new map name',
    type: 'text'
  })
  let modal = new Modal({
    title: 'choose a name for the new map',
    width: 'auto',
    height: 'auto',
    parent: gui.extensions.MapExtension,
    onsubmit: () => {
      let conf = baseConfiguration()
      conf.name = name.value
      cl(conf)
    },
    oncancel: () => {}
  })

  modal.addBody(body)
  modal.show()

}


exports.exportConfiguration = exportConfiguration
exports.saveAs = saveAs
exports.parseLayer = parseLayer
exports.parseMap = parseMap
exports.loadMap = loadMap
exports.loadMapFile = loadMapfromFile
exports.baseConfiguration = baseConfiguration
exports.basePath = basePath
exports.modal = {
  guideLayer: modalGuideLayer,
  tileLayer: modaltilelayer,
  csvTiles: modalcsvlayer,
  createMap: createMap
}
