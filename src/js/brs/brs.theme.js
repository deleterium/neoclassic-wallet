export function theme () {
    const mythemes = [
        'theme-dark',
        'theme-blue',
        'theme-red',
        'theme-yellow',
        'theme-purple',
        'theme-green'
    ]
    function get (name) {
        if (typeof (Storage) !== 'undefined') {
            return localStorage.getItem(name)
        }
    }
    function store (name, val) {
        if (typeof (Storage) !== 'undefined') {
            localStorage.setItem(name, val)
        }
    }
    function changetheme (cls) {
        $.each(mythemes, function (i) {
            $('body').removeClass(mythemes[i])
        })
        $('body').addClass(cls)
        store('theme', cls)
        return false
    }
    function setup () {
        const tmp = get('theme')
        if (tmp && $.inArray(tmp, mythemes)) {
            changetheme(tmp)
        } else {
            changetheme('theme-dark')
        }
        // Add the change theme listener
        $('[data-theme]').on('click', function (e) {
            if ($(this).hasClass('knob')) {
                return
            }
            e.preventDefault()
            changetheme($(this).data('theme'))
        })
    }
    // Create the new tab
    const $themesettings = $('<div />', {
        class: 'theme-settings active'
    })
    // Create the menu
    const $themeSettings = $('<div />')
    // theme options
    const $themesList = $('<ul />', {
        class: 'list-unstyled clearfix'
    })
    const $themeBlue =
    $('<li />', {
        style: 'float:left; width: 150px; padding: 5px;'
    })
        .append('<a href="javascript:void(0)" data-theme="theme-blue" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
      '<div><span style="display:block; width: 20%; float: left; height: 7px; background: #367fa9"></span><span class="bg-light-blue" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
      '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #f4f5f7"></span></div>' +
      '</a>')
    $themesList.append($themeBlue)
    const $themePurple =
    $('<li />', {
        style: 'float:left; width: 150px; padding: 5px;'
    })
        .append('<a href="javascript:void(0)" data-theme="theme-purple" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
      '<div><span style="display:block; width: 20%; float: left; height: 7px;" class="bg-purple-active"></span><span class="bg-purple" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
      '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #f4f5f7"></span></div>' +
      '</a>')
    $themesList.append($themePurple)
    const $themeGreen =
    $('<li />', {
        style: 'float:left; width: 150px; padding: 5px;'
    })
        .append('<a href="javascript:void(0)" data-theme="theme-green" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
      '<div><span style="display:block; width: 20%; float: left; height: 7px;" class="bg-green-active"></span><span class="bg-green" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
      '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #f4f5f7"></span></div>' +
      '</a>')
    $themesList.append($themeGreen)
    const $themeRed =
    $('<li />', {
        style: 'float:left; width: 150px; padding: 5px;'
    })
        .append('<a href="javascript:void(0)" data-theme="theme-red" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
      '<div><span style="display:block; width: 20%; float: left; height: 7px;" class="bg-red-active"></span><span class="bg-red" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
      '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #f4f5f7"></span></div>' +
      '</a>')
    $themesList.append($themeRed)
    const $themeYellow =
        $('<li />', {
            style: 'float:left; width: 150px; padding: 5px;'
        }).append('<a href="javascript:void(0)" data-theme="theme-yellow" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
      '<div><span style="display:block; width: 20%; float: left; height: 7px;" class="bg-yellow-active"></span><span class="bg-yellow" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
      '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #f4f5f7"></span></div>' +
      '</a>')
    $themesList.append($themeYellow)
    const $themeDark =
        $('<li />', {
            style: 'float:left; width: 150px; padding: 5px;'
        }).append('<a href="javascript:void(0)" data-theme="theme-dark" style="display: block; box-shadow: 0 0 3px rgba(0,0,0,0.4)" class="clearfix full-opacity-hover">' +
        '<div><span style="display:block; width: 20%; float: left; height: 7px;" class="bg-dark-active"></span><span class="bg-dark" style="display:block; width: 80%; float: left; height: 7px;"></span></div>' +
        '<div><span style="display:block; width: 20%; float: left; height: 20px; background: #222d32"></span><span style="display:block; width: 80%; float: left; height: 20px; background: #000000"></span></div>' +
        '</a>')
    $themesList.append($themeDark)
    $themeSettings.append($themesList)
    $themesettings.append($themeSettings)
    $('#themebox').after($themesettings)
    setup()
}
