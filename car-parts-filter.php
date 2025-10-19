<?php
/**
 * Plugin Name: Car Parts Filter for WooCommerce (EN + AR) — by Abdalrhman Salah
 * Description: Brand → Model → Year filter for EN & AR. EN shortcode: [car_parts_filter] — AR shortcode: [car_parts_filter_ar] (Arabic only on /ar/ and Arabic terms/products).
 * Author: Abdalrhman Salah — Jeeem Web
 * Author URI: https://wa.me/201065477152
 * Plugin URI: https://jeeemweb.com/
 * Version: 1.3
 * Text Domain: jeeem-car-filter
 */

if (!defined('ABSPATH')) exit;

/* -----------------------------------------------------------
   Helpers: detect AR context + lang arg for WPML/Polylang
----------------------------------------------------------- */
function jcf_is_ar_context() {
    if (function_exists('pll_current_language')) {
        return pll_current_language('slug') === 'ar';
    }
    if (apply_filters('wpml_current_language', null)) {
        return apply_filters('wpml_current_language', null) === 'ar';
    }
    return (strpos($_SERVER['REQUEST_URI'] ?? '', '/ar/') !== false);
}

/** Add 'lang' => 'ar' / 'en' to get_terms / WP_Query when possible */
function jcf_lang_args($args = [], $lang = null) {
    $lang = $lang ?: (jcf_is_ar_context() ? 'ar' : 'en');
    // Polylang & WPML both respect 'lang' in many queries
    $args['lang'] = $lang;
    return $args;
}

/* ============================================================
   ✅ ENGLISH — Shortcode stays EXACTLY as your code
   Shortcode: [car_parts_filter]
============================================================ */
add_shortcode('car_parts_filter', function () {
    // Render only on the homepage to reduce global overhead
    if (!is_front_page()) return '';

    // Get Brands (parents) that actually have products
    $brands = get_terms(jcf_lang_args([
        'taxonomy'   => 'car',
        'hide_empty' => true,
        'parent'     => 0,
    ], 'en'));

    wp_enqueue_script('jquery');

    // Dummy handle to inject inline JS (deferred)
    wp_register_script('car-filter-js', false, ['jquery'], '1.3-en', true);
    wp_enqueue_script('car-filter-js');

    // Add "defer" to this script only
    add_filter('script_loader_tag', function ($tag, $handle) {
        if ($handle === 'car-filter-js') {
            $tag = str_replace(' src', ' defer src', $tag);
        }
        return $tag;
    }, 10, 2);

    $shop_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/shop/');

    // Resolve car_year slug from taxonomy rewrite settings
    $car_year_slug = 'car_year';
    if ($tx = get_taxonomy('car_year')) {
        if (!empty($tx->rewrite['slug'])) $car_year_slug = trim($tx->rewrite['slug'], '/');
    }

    wp_localize_script('car-filter-js', 'carFilter', [
        'ajax_url'      => admin_url('admin-ajax.php'),
        'nonce'         => wp_create_nonce('car_filter_nonce'),
        'shop_url'      => $shop_url,
        'home_url'      => home_url('/'),
        'car_year_slug' => $car_year_slug,
    ]);

    $js = <<<JS
jQuery(function($){
    var $brand = $('#car_brand'),
        $model = $('#car_model'),
        $year  = $('#car_year'),
        $btn   = $('#car_search_btn');

    function resetModels(){ $model.prop('disabled', true).html('<option value="">Select model</option>'); }
    function resetYears(){  $year.prop('disabled',  true).html('<option value="">Select year</option>'); }

    // Simple browser cache
    function cacheGet(key){ try{ return JSON.parse(sessionStorage.getItem(key) || 'null'); }catch(e){ return null; } }
    function cacheSet(key, val){ try{ sessionStorage.setItem(key, JSON.stringify(val)); }catch(e){} }

    function setLoading($el, isLoading){
        if(isLoading){ $el.addClass('is-loading'); }
        else{ $el.removeClass('is-loading'); }
    }

    // Brand → Models (only models with products)
    $brand.on('change', function(){
        var brand = $(this).val();
        resetModels(); resetYears();
        if(!brand){ return; }

        var key = 'car_models_'+brand;
        var cached = cacheGet(key);
        if(cached){
            fillModels(cached);
            return;
        }

        setLoading($model, true);
        $.post(carFilter.ajax_url, { action:'get_car_models', nonce:carFilter.nonce, brand:brand }, function(res){
            setLoading($model, false);
            if(res && res.success){
                cacheSet(key, res.data || []);
                fillModels(res.data || []);
            } else {
                resetModels();
            }
        });
    });

    function fillModels(list){
        var opts = '<option value="">Select model</option>';
        $.each(list, function(_, t){ opts += '<option value="'+t.slug+'">'+t.name+'</option>'; });
        $model.html(opts).prop('disabled', list.length === 0);
    }

    // Model → Years (only years with products)
    $model.on('change', function(){
        var model = $(this).val();
        resetYears();
        if(!model){ return; }

        var key = 'car_years_'+model;
        var cached = cacheGet(key);
        if(cached){
            fillYears(cached);
            return;
        }

        setLoading($year, true);
        $.post(carFilter.ajax_url, { action:'get_car_years', nonce:carFilter.nonce, model:model }, function(res){
            setLoading($year, false);
            if(res && res.success){
                cacheSet(key, res.data || []);
                fillYears(res.data || []);
            } else {
                resetYears();
            }
        });
    });

    function fillYears(list){
        var opts = '<option value="">Select year</option>';
        $.each(list, function(_, t){ opts += '<option value="'+t.slug+'">'+t.name+'</option>'; });
        $year.html(opts).prop('disabled', list.length === 0);
    }

    // Build URL:
    // If year selected → /car_year/{year}/?filter_car={model}
    // Else → Shop ?filter_car={model}
    $btn.on('click', function(e){
        e.preventDefault();

        var model = $model.val();
        var year  = $year.val();

        if (year) {
            var base = carFilter.home_url.replace(/\/+$/, '') + '/'
                     + carFilter.car_year_slug.replace(/^\/+|\/+$/g,'') + '/'
                     + encodeURIComponent(year) + '/';

            var url = base;
            if (model) url += '?filter_car=' + encodeURIComponent(model);
            window.location.href = url;
            return;
        }

        var url = carFilter.shop_url;
        var params = [];
        if (model) params.push('filter_car=' + encodeURIComponent(model));
        if (params.length) url += (url.indexOf('?')>-1 ? '&' : '?') + params.join('&');
        window.location.href = url;
    });
});
JS;
    wp_add_inline_script('car-filter-js', $js);

    ob_start(); ?>
    <div class="car-filter car-filter--elegant">
        <div class="cf-headline">
            <h3 class="cf-title">Find Parts For Your Car</h3>
            <p class="cf-sub">Choose brand, model, then year</p>
        </div>

        <div class="cf-grid" style="display:flex;gap:14px;flex-wrap:wrap;">
            <label class="cf-field cf-field--brand" style="flex:1 1 220px;min-width:220px;">
                <span class="cf-label">Brand</span>
                <select id="car_brand" class="cf-select">
                    <option value="">Select brand</option>
                    <?php foreach ($brands as $b): ?>
                        <option value="<?php echo esc_attr($b->slug); ?>"><?php echo esc_html($b->name); ?></option>
                    <?php endforeach; ?>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <label class="cf-field cf-field--model" style="flex:1 1 220px;min-width:220px;">
                <span class="cf-label">Model</span>
                <select id="car_model" class="cf-select" disabled>
                    <option value="">Select model</option>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <label class="cf-field cf-field--year" style="flex:1 1 220px;min-width:220px;">
                <span class="cf-label">Year</span>
                <select id="car_year" class="cf-select" disabled>
                    <option value="">Select year</option>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <button id="car_search_btn" class="cf-btn">Search now</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
});

/* =============================
   AJAX HANDLERS (EN) — unchanged
============================= */
add_action('wp_ajax_get_car_models', 'car_filter_get_models');
add_action('wp_ajax_nopriv_get_car_models', 'car_filter_get_models');
function car_filter_get_models() {
    check_ajax_referer('car_filter_nonce', 'nonce');
    $brand = sanitize_text_field($_POST['brand'] ?? '');
    if (!$brand) wp_send_json_success([]);

    $brand_term = get_term_by('slug', $brand, 'car');
    if (!$brand_term) wp_send_json_success([]);

    // Models with products only
    $models = get_terms(jcf_lang_args([
        'taxonomy'   => 'car',
        'hide_empty' => true,
        'parent'     => $brand_term->term_id,
    ], 'en'));

    $data = [];
    foreach ($models as $m) {
        $data[] = ['slug' => $m->slug, 'name' => $m->name];
    }
    wp_send_json_success($data);
}

add_action('wp_ajax_get_car_years', 'car_filter_get_years');
add_action('wp_ajax_nopriv_get_car_years', 'car_filter_get_years');
function car_filter_get_years() {
    check_ajax_referer('car_filter_nonce', 'nonce');
    $model = sanitize_text_field($_POST['model'] ?? '');
    if (!$model) wp_send_json_success([]);

    $model_term = get_term_by('slug', $model, 'car');
    if (!$model_term) wp_send_json_success([]);

    // Product IDs attached to this model (no children)
    $q = new WP_Query(jcf_lang_args([
        'post_type'      => 'product',
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'tax_query'      => [[
            'taxonomy'         => 'car',
            'field'            => 'term_id',
            'terms'            => $model_term->term_id,
            'include_children' => false,
        ]],
        'no_found_rows'  => true,
    ], 'en'));

    // Years with products only
    $years = [];
    if (!empty($q->posts)) {
        $years = wp_get_object_terms($q->posts, 'car_year', ['hide_empty' => true]);
    }

    $data = [];
    foreach ($years as $y) {
        $data[] = ['slug' => $y->slug, 'name' => $y->name];
    }
    wp_send_json_success($data);
}

/* ============================================================
   🇸🇦 ARABIC — mirrors your code, Arabic-only data, RTL & order
   Shortcode: [car_parts_filter_ar]
============================================================ */
add_shortcode('car_parts_filter_ar', function () {
    // يظهر فقط بالنسخة العربية وبالصفحة الرئيسية
    if (!jcf_is_ar_context()) return '';
    if (!is_front_page()) return '';

    // Brands (Arabic only)
    $brands = get_terms(jcf_lang_args([
        'taxonomy'   => 'car',
        'hide_empty' => true,
        'parent'     => 0,
    ], 'ar'));

    wp_enqueue_script('jquery');

    // نفس بنية التحميل والتأجيل
    wp_register_script('car-filter-js-ar', false, ['jquery'], '1.3-ar', true);
    wp_enqueue_script('car-filter-js-ar');

    add_filter('script_loader_tag', function ($tag, $handle) {
        if ($handle === 'car-filter-js-ar') {
            $tag = str_replace(' src', ' defer src', $tag);
        }
        return $tag;
    }, 10, 2);

    // روابط عربية
    $shop_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/ar/shop/');

    $car_year_slug = 'car_year';
    if ($tx = get_taxonomy('car_year')) {
        if (!empty($tx->rewrite['slug'])) $car_year_slug = trim($tx->rewrite['slug'], '/');
    }

    wp_localize_script('car-filter-js-ar', 'carFilterAR', [
        'ajax_url'      => admin_url('admin-ajax.php'),
        'nonce'         => wp_create_nonce('car_filter_nonce_ar'),
        'shop_url'      => $shop_url,
        'home_url'      => home_url('/ar/'),
        'car_year_slug' => $car_year_slug,
    ]);

    // نفس منطق JS مع ترجمة النصوص
    $js_ar = <<<JS
jQuery(function($){
    var $brand = $('#car_brand_ar'),
        $model = $('#car_model_ar'),
        $year  = $('#car_year_ar'),
        $btn   = $('#car_search_btn_ar');

    function resetModels(){ $model.prop('disabled', true).html('<option value="">اختر الموديل</option>'); }
    function resetYears(){  $year.prop('disabled',  true).html('<option value="">اختر السنة</option>'); }

    function cacheGet(key){ try{ return JSON.parse(sessionStorage.getItem(key) || 'null'); }catch(e){ return null; } }
    function cacheSet(key, val){ try{ sessionStorage.setItem(key, JSON.stringify(val)); }catch(e){} }

    function setLoading($el, isLoading){
        if(isLoading){ $el.addClass('is-loading'); }
        else{ $el.removeClass('is-loading'); }
    }

    // Brand → Models
    $brand.on('change', function(){
        var brand = $(this).val();
        resetModels(); resetYears();
        if(!brand){ return; }

        var key = 'car_models_ar_'+brand;
        var cached = cacheGet(key);
        if(cached){
            fillModels(cached);
            return;
        }

        setLoading($model, true);
        $.post(carFilterAR.ajax_url, { action:'get_car_models_ar', nonce:carFilterAR.nonce, brand:brand }, function(res){
            setLoading($model, false);
            if(res && res.success){
                cacheSet(key, res.data || []);
                fillModels(res.data || []);
            } else {
                resetModels();
            }
        });
    });

    function fillModels(list){
        var opts = '<option value="">اختر الموديل</option>';
        $.each(list, function(_, t){ opts += '<option value="'+t.slug+'">'+t.name+'</option>'; });
        $model.html(opts).prop('disabled', list.length === 0);
    }

    // Model → Years
    $model.on('change', function(){
        var model = $(this).val();
        resetYears();
        if(!model){ return; }

        var key = 'car_years_ar_'+model;
        var cached = cacheGet(key);
        if(cached){
            fillYears(cached);
            return;
        }

        setLoading($year, true);
        $.post(carFilterAR.ajax_url, { action:'get_car_years_ar', nonce:carFilterAR.nonce, model:model }, function(res){
            setLoading($year, false);
            if(res && res.success){
                cacheSet(key, res.data || []);
                fillYears(res.data || []);
            } else {
                resetYears();
            }
        });
    });

    function fillYears(list){
        var opts = '<option value="">اختر السنة</option>';
        $.each(list, function(_, t){ opts += '<option value="'+t.slug+'">'+t.name+'</option>'; });
        $year.html(opts).prop('disabled', list.length === 0);
    }

    // لو السنة مختارة → /ar/{car_year_slug}/{year}/?filter_car={model}
    // غير كده → /ar/shop/?filter_car={model}
    $btn.on('click', function(e){
        e.preventDefault();

        var model = $model.val();
        var year  = $year.val();

        if (year) {
            var base = carFilterAR.home_url.replace(/\/+$/, '') + '/'
                     + carFilterAR.car_year_slug.replace(/^\/+|\/+$/g,'') + '/'
                     + encodeURIComponent(year) + '/';

            var url = base;
            if (model) url += '?filter_car=' + encodeURIComponent(model);
            window.location.href = url;
            return;
        }

        var url = carFilterAR.shop_url;
        var params = [];
        if (model) params.push('filter_car=' + encodeURIComponent(model));
        if (params.length) url += (url.indexOf('?')>-1 ? '&' : '?') + params.join('&');
        window.location.href = url;
    });
});
JS;
    wp_add_inline_script('car-filter-js-ar', $js_ar);

    // ترتيب الحقول: ماركة يمين → موديل وسط → سنة يسار (RTL)
    ob_start(); ?>
    <div class="car-filter car-filter--elegant" dir="rtl" style="text-align:right;">
        <div class="cf-headline">
            <h3 class="cf-title"><?php echo esc_html__('ابحث عن قطع غيار سيارتك', 'jeeem-car-filter'); ?></h3>
            <p class="cf-sub"><?php echo esc_html__('اختر الماركة ثم الموديل ثم السنة', 'jeeem-car-filter'); ?></p>
        </div>

        <div class="cf-grid" style="display:flex;gap:14px;flex-wrap:wrap;flex-direction:row;justify-content:flex-start;">
            <!-- الماركة (يمين) -->
            <label class="cf-field cf-field--brand" style="flex:1 1 220px;min-width:220px;order:0;">
                <span class="cf-label"><?php echo esc_html__('الماركة', 'jeeem-car-filter'); ?></span>
                <select id="car_brand_ar" class="cf-select">
                    <option value=""><?php echo esc_html__('اختر الماركة', 'jeeem-car-filter'); ?></option>
                    <?php foreach ($brands as $b): ?>
                        <option value="<?php echo esc_attr($b->slug); ?>"><?php echo esc_html($b->name); ?></option>
                    <?php endforeach; ?>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <!-- الموديل (وسط) -->
            <label class="cf-field cf-field--model" style="flex:1 1 220px;min-width:220px;order:1;">
                <span class="cf-label"><?php echo esc_html__('الموديل', 'jeeem-car-filter'); ?></span>
                <select id="car_model_ar" class="cf-select" disabled>
                    <option value=""><?php echo esc_html__('اختر الموديل', 'jeeem-car-filter'); ?></option>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <!-- السنة (يسار) -->
            <label class="cf-field cf-field--year" style="flex:1 1 220px;min-width:220px;order:2;">
                <span class="cf-label"><?php echo esc_html__('السنة', 'jeeem-car-filter'); ?></span>
                <select id="car_year_ar" class="cf-select" disabled>
                    <option value=""><?php echo esc_html__('اختر السنة', 'jeeem-car-filter'); ?></option>
                </select>
                <span class="cf-spinner" aria-hidden="true"></span>
            </label>

            <button id="car_search_btn_ar" class="cf-btn" style="order:3;">
                <?php echo esc_html__('ابحث الآن', 'jeeem-car-filter'); ?>
            </button>
        </div>
    </div>
    <?php
    return ob_get_clean();
});

/* =============================
   AJAX (AR) — نفس منطقك مع تقييد اللغة
============================= */
add_action('wp_ajax_get_car_models_ar', 'car_filter_get_models_ar');
add_action('wp_ajax_nopriv_get_car_models_ar', 'car_filter_get_models_ar');
function car_filter_get_models_ar() {
    check_ajax_referer('car_filter_nonce_ar', 'nonce');
    $brand = sanitize_text_field($_POST['brand'] ?? '');
    if (!$brand) wp_send_json_success([]);

    $brand_term = get_term_by('slug', $brand, 'car');
    if (!$brand_term) wp_send_json_success([]);

    // Models (Arabic only)
    $models = get_terms(jcf_lang_args([
        'taxonomy'   => 'car',
        'hide_empty' => true,
        'parent'     => $brand_term->term_id,
    ], 'ar'));

    $data = [];
    foreach ($models as $m) {
        $data[] = ['slug' => $m->slug, 'name' => $m->name];
    }
    wp_send_json_success($data);
}

add_action('wp_ajax_get_car_years_ar', 'car_filter_get_years_ar');
add_action('wp_ajax_nopriv_get_car_years_ar', 'car_filter_get_years_ar');
function car_filter_get_years_ar() {
    check_ajax_referer('car_filter_nonce_ar', 'nonce');
    $model = sanitize_text_field($_POST['model'] ?? '');
    if (!$model) wp_send_json_success([]);

    $model_term = get_term_by('slug', $model, 'car');
    if (!$model_term) wp_send_json_success([]);

    // Products in AR only
    $q = new WP_Query(jcf_lang_args([
        'post_type'      => 'product',
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'tax_query'      => [[
            'taxonomy'         => 'car',
            'field'            => 'term_id',
            'terms'            => $model_term->term_id,
            'include_children' => false,
        ]],
        'no_found_rows'  => true,
    ], 'ar'));

    // Years with products only (from Arabic product set)
    $years = [];
    if (!empty($q->posts)) {
        $years = wp_get_object_terms($q->posts, 'car_year', ['hide_empty' => true]);
    }

    $data = [];
    foreach ($years as $y) {
        $data[] = ['slug' => $y->slug, 'name' => $y->name];
    }
    wp_send_json_success($data);
}
/* ============================================================
   🔧 Layout Fixes (RTL / LTR + Button position)
============================================================ */
add_action('wp_head', function() {
?>
<style>
/* ---------- English version (LTR) ---------- */
html[lang="en"] .car-filter {
  direction: ltr !important;
  text-align: left !important;
}
html[lang="en"] .car-filter .cf-grid {
  display: flex !important;
  flex-direction: row !important;
  justify-content: flex-start !important;
  flex-wrap: wrap;
  gap: 14px;
}
html[lang="en"] .car-filter .cf-field {
  flex: 1 1 220px;
  min-width: 220px;
}
html[lang="en"] .car-filter .cf-btn {
  flex: 0 0 auto;
  width: auto;
  margin-inline-start: auto;
  margin-inline-end: 0;
  margin-top: 18px;
  padding: 10px 20px;
  background-color: #fbc023;
  color: #111;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  transition: all .3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
html[lang="en"] .car-filter .cf-btn:hover {
  background-color: #d6a712;
  cursor: pointer;
}

/* ---------- Arabic version (RTL) ---------- */
html[lang="ar"] .car-filter {
  direction: rtl !important;
  text-align: right !important;
}
html[lang="ar"] .car-filter .cf-grid {
  display: flex !important;
  flex-direction: row !important;
  justify-content: flex-start !important;
  flex-wrap: wrap;
  gap: 14px;
}
html[lang="ar"] .car-filter .cf-field {
  flex: 1 1 220px;
  min-width: 220px;
}
html[lang="ar"] .car-filter .cf-field--brand { order: 0; }
html[lang="ar"] .car-filter .cf-field--model { order: 1; }
html[lang="ar"] .car-filter .cf-field--year { order: 2; }
html[lang="ar"] .car-filter .cf-btn {
  flex: 0 0 auto;
  width: auto;
  margin-inline-start: 0;
  margin-inline-end: auto;
  margin-top: 18px;
  padding: 10px 20px;
  background-color: #fbc023;
  color: #111;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  transition: all .3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
html[lang="ar"] .car-filter .cf-btn:hover {
  background-color: #d6a712;
  cursor: pointer;
}

/* responsive fix */
@media (max-width: 768px) {
  html[lang="en"] .car-filter .cf-grid,
  html[lang="ar"] .car-filter .cf-grid {
    flex-direction: column !important;
    align-items: stretch;
  }
}
</style>
<?php
});
